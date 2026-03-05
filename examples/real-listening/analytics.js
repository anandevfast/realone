
// old route
router.post('/overview', overviewController.getOverview)
router.post('/overviewCompare', async (req, res) => {
    let startDate = moment(req.body.startDate)
    let endDate = moment(req.body.endDate)
    let diff_hour = endDate.diff(startDate, 'hour')
    let find = req.body.find || {}
    let temp_find = await fl.filterFormal(find, req.body.email)
    let execute = engagement(req.body.metric)
  
    if (!req.body?.newtab) {
      const getQuickReturn = await getQuickQuery(req.body.email, req.body.template_id, req.body, `overviewCompare.${req.body.metric}`)
      if (getQuickReturn) return res.json(getQuickReturn)
    }
  
    let compare_temp_series = []
    let compareDate = {
      start: moment(startDate).subtract(endDate.diff(startDate, 'day', true), 'day'),
      end: moment(startDate).subtract('1', 'second'),
    }
  
    let firstDate_start = moment(_.cloneDeep(startDate).startOf('month'))
    let lastDate_end = moment(_.cloneDeep(endDate).endOf('month'))
  
    if (firstDate_start.diff(startDate, 'day') == 0 && lastDate_end.diff(endDate, 'day') == 0) {
      let firstDate_compare_start = moment(_.cloneDeep(startDate).subtract('1', 'month')).startOf('month')
      let lastDate_compare_end = moment(_.cloneDeep(endDate).subtract('1', 'month')).endOf('month')
      compareDate.start = firstDate_compare_start
      compareDate.end = lastDate_compare_end
    }
  
    let filter = {
      find: req.body.find || {},
      metric: req.body.metric || {},
      startDate: compareDate.start || {},
      endDate: compareDate.end || {},
      email: req.body.email,
    }
    const { match, hint, advanceSearchFields: advanceSearch } = await filterFormalV2(filter)
    const advanceSearchFields = !_.isEmpty(advanceSearch) ? [advanceSearch] : []
    if (diff_hour > 120) {
      let arr_aggregate = [
        ...advanceSearchFields,
        {
          $match: match,
        },
        ...execute,
        {
          $group: {
            _id: {
              channel: '$channel',
              // keywords: '$keywords',
              keywords: { $cond: [{ $eq: ['$keywords', []] }, ['No Keyword'], '$keywords'] },
              keyword_sentiment: '$keyword_sentiment',
              keyword_tag: '$keyword_tag',
              tags: '$tags',
              sentiment: {
                $cond: {
                  if: {
                    $in: ['$content.sentiment', ['positive', 'negative']],
                  },
                  then: '$content.sentiment',
                  else: 'neutral',
                },
              },
              date: DATE_FILTER_GROUP,
            },
            count: { $sum: '$engagement' },
            countMessage: { $sum: 1 },
          },
        },
        {
          $group: {
            _id: '$_id.date',
            data: {
              $push: {
                channel: '$_id.channel',
                keyword: '$_id.keywords',
                keyword_sentiment: '$_id.keyword_sentiment',
                keyword_tag: '$_id.keyword_tag',
                tags: '$_id.tags',
                sentiment: ['$_id.sentiment'],
                count: '$count',
                countMessage: '$countMessage',
              },
            },
            count: { $sum: '$count' },
          },
        },
      ]
      // console.log('arr_aggregate', JSON.stringify(arr_aggregate))
      compare_temp_series = await mongodb.findAggregateOpts('social_messages', 'socialSchema', arr_aggregate, { hint })
    } else {
      let arr_aggregate = [
        ...advanceSearchFields,
        {
          $match: match,
        },
        ...execute,
        {
          $group: {
            _id: {
              channel: '$channel',
              // keywords: '$keywords',
              keywords: { $cond: [{ $eq: ['$keywords', []] }, ['No Keyword'], '$keywords'] },
              keyword_sentiment: '$keyword_sentiment',
              keyword_tag: '$keyword_tag',
              tags: '$tags',
              hour: '$hour',
              sentiment: {
                $cond: {
                  if: {
                    $in: ['$content.sentiment', ['positive', 'negative']],
                  },
                  then: '$content.sentiment',
                  else: 'neutral',
                },
              },
            },
            count: { $sum: '$engagement' },
            countMessage: { $sum: 1 },
          },
        },
        {
          $group: {
            _id: '$_id.hour',
            data: {
              $push: {
                channel: '$_id.channel',
                keyword: '$_id.keywords',
                keyword_sentiment: '$_id.keyword_sentiment',
                keyword_tag: '$_id.keyword_tag',
                tags: '$_id.tags',
                sentiment: ['$_id.sentiment'],
                count: '$count',
                countMessage: '$countMessage',
              },
            },
            count: { $sum: '$count' },
          },
        },
      ]
      // console.log('arr_aggregate 2', JSON.stringify(arr_aggregate))
      compare_temp_series = await mongodb.findAggregateOpts('social_messages', 'socialSchema', arr_aggregate, { hint })
    }
  
    let compareData = [].concat(
      ...compare_temp_series.map((compare_queryResult) => {
        return compare_queryResult.data
      })
    )
  
    // let keywords = [...new Set([].concat(...compareData.map((data) => data.keyword)))]
    let keywords = []
    let checkNoKeyword = [...new Set([].concat(...compareData.map((data) => data.keyword)))].includes('No Keyword')
    if (filter.find.keywords) {
      // keywords = keywords.filter((keyword) => filter.find.keywords.includes(keyword))
      keywords = checkNoKeyword ? [...filter.find.keywords, 'No Keyword'] : filter.find.keywords
    } else {
      keywords = [...new Set([].concat(...compareData.map((data) => data.keyword)))]
    }
    keywords.sort()
  
    // let channels = filter.find.channel ? filter.find.channel : [...new Set(compareData.map((arr) => arr.channel.split('-')[0]))]
    let channels = []
    if (!_.isEmpty(filter.find.channel)) {
      let arrChannel = filter.find.channel
      // channels = filter.find.channel
  
      channels = arrChannel.flatMap((channel) =>
        channel.endsWith('*')
          ? channel.startsWith('facebook')
            ? ['facebook', 'facebookgroup']
            : channel.replace('*', '')
          : channel.endsWith('-')
            ? channel.replace('-', '')
            : channel
      )
    } else {
      channels = [...new Set(compareData.map((arr) => arr.channel?.split('-')[0]))]
    }
    channels.sort()
  
    let allSentiment = ['positive', 'neutral', 'negative']
    let sentiments = filter.find.sentiment
      ? filter.find.sentiment
      : [...new Set([].concat(...compareData.map((arr) => arr.keyword_sentiment.map((keyword_sentiment) => _.last(keyword_sentiment.split('§'))))))]
    allSentiment = allSentiment.filter((arr) => sentiments.includes(arr))
  
    // Tags
    let tags = []
    if (filter.find.tags) {
      tags = filter.find.tags
    } else {
      tags = [...new Set([].concat(...compareData.map((d) => d.tags)))]
    }
  
    if (filter.find.ex_tags) {
      let exTags = [...new Set(filter.find.ex_tags)]
      tags = tags.filter((tag) => !exTags.find((exTag) => exTag == tag))
    }
    tags = tags.filter((tag) => tag !== undefined)
    tags.sort()
  
    let category_tags = !_.isEmpty(tags) ? [...new Set(tags.map((tag) => tag && tag.split('_')[0]))] : []
    category_tags.sort()
  
    let resResult = {
      shareOfKeywordTopic: fl.getPeriodComparePercentage('keyword', compare_temp_series, { keywords }),
      buzzTimelineByKeywordTopics: fl.getPeriodComparePercentage('keyword', compare_temp_series, { keywords }),
      shareOfChannel: fl.getPeriodComparePercentage('channel', compare_temp_series, { channels }),
      channelByKeyword: fl.getPeriodComparePercentage('keyword', compare_temp_series, { keywords, channels }),
      buzzTimelineByTotal: fl.getPeriodComparePercentage('keyword', compare_temp_series, { keywords }),
      channelByChannel: fl.getPeriodComparePercentage('channel', compare_temp_series, { channels }),
      buzzTimelineByChannel: fl.getPeriodComparePercentage('channel', compare_temp_series, { channels }),
      shareOfSentiment: fl.getPeriodComparePercentage('sentiment', compare_temp_series, { sentiments: allSentiment }),
      sentimentOverTime: fl.getPeriodComparePercentage('sentiment', compare_temp_series, { sentiments: allSentiment }),
      channelBySentiment: fl.getPeriodComparePercentage('sentiment', compare_temp_series, { sentiments: allSentiment }),
      buzzTimelineByTags: fl.getPeriodComparePercentage('tag', compare_temp_series, { tags }),
      shareOfTags: fl.getPeriodComparePercentage('tag', compare_temp_series, { tags }),
      channelByTags: fl.getPeriodComparePercentage('tag', compare_temp_series, { tags }),
    }
  
    if (!req.body?.newtab) {
      await getQuickQuery(req.body.email, req.body.template_id, req.body, `overviewCompare.${req.body.metric}`, resResult)
    }
  
    res.json(resResult)
  })

//old controller code
async function getOverview(req, res) {
    let data = req.body
    try {
      let social_matchs = await axios('https://api.arukas.app/api/fetchFindOne', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        data: {
          collection: 'social_matchs',
          schema: 'matchSchema',
          obj: { name: process.env.DB_MONGODB },
          sort: {},
          limit: null,
          db: 'dataCenter',
        },
      })
      data.keywords = await fl.keywordColor(social_matchs.data?.values || [])
  
      // let items = await mongodb.find(`socialTags`, 'socialTagsSchema', {})
  
      let tag_name_maps = await mongodb.find('socialTags', 'socialTagsSchema')
      data.tags = await fl.keywordColor(tag_name_maps || [])
    } catch (error) {
      console.error('Error getOverview social_matchs:', error.toString())
      data.keywords = []
      data.tags = []
    }
    data.keyword_name_maps = req.app.get('keyword_name_maps')
    data.tag_name_maps = req.app.get('tag_name_maps')
    data.easy_mode = req.app.get('easy_mode')
  
    if (!data?.newtab) {
      const getQuickReturn = await getQuickQuery(data.email, data.template_id, data, `overview.${data.metric}`)
      if (getQuickReturn) return res.json(getQuickReturn)
    }
  
    let result = null
    result = await getChartData(data)
    res.json(result)
  }
  
  async function getChartData(data) {
    try {
      const keywords = data.keywords
      const tags = data.tags
      const keyword_name_maps = data.keyword_name_maps
      const tag_name_maps = data.tag_name_maps
      const easy_mode = data.easy_mode
      const metric = data.metric
      const newtab = data?.newtab == 1 ? 'newtab' : ''
      // console.log('easy_mode', easy_mode)
      let result = null
      let startDate = moment(data.startDate).utcOffset(7)
      let endDate = moment(data.endDate).utcOffset(7)
  
      let diff_hour = endDate.diff(startDate, 'hour')
      let find = data.find || {}
      let parent = {}
  
      if (newtab) {
        parent = await mongodb.findById('social_messages', 'socialSchema', mongoose.Types.ObjectId(find.arr_id[0]))
  
        let channel = parent.channel
        let regex = /-comment|-subcomment|-retweet|-reply/gi
  
        if (!regex.test(channel)) find.code = [parent.code]
        find.newtab = { channel: channel }
      }
  
      let temp_find = await fl.filterFormal(find, data.email, newtab)
      let execute = engagement(data.metric)
      let temp_series = []
      let filter = {
        find: data.find || {},
        metric: data.metric || {},
        startDate: startDate || {},
        endDate: endDate || {},
        email: data.email,
      }
      // console.log('filter', JSON.stringify(filter))
      let chartName = data.chartName
      const { match, hint, advanceSearchFields: advanceSearch } = await filterFormalV2(filter)
      const advanceSearchFields = !_.isEmpty(advanceSearch) ? [advanceSearch] : []
      if (diff_hour > 120) {
        let arr_aggregate = [
          ...advanceSearchFields,
          { $match: match },
          ...execute,
          {
            $group: {
              _id: {
                // channel: { $cond: [{ $eq: ['$channel', 'youtube'] }, 'youtube-post', '$channel'] },
                channel: {
                  $cond: {
                    if: { $eq: ['$channel', 'youtube'] },
                    then: 'youtube-post',
                    else: { $cond: { if: { $eq: ['$channel', 'website'] }, then: 'website-post', else: '$channel' } },
                  },
                },
                // keywords: '$keywords',
                keywords: { $cond: [{ $eq: ['$keywords', []] }, ['No Keyword'], '$keywords'] },
                keyword_sentiment: '$keyword_sentiment',
                keyword_tag: '$keyword_tag',
                tags: '$tags',
                sentiment: {
                  $cond: {
                    if: {
                      $in: ['$content.sentiment', ['positive', 'negative']],
                    },
                    then: '$content.sentiment',
                    else: 'neutral',
                  },
                },
                date: DATE_FILTER_GROUP,
              },
              count: { $sum: '$engagement' },
              countMessage: { $sum: 1 },
            },
          },
          {
            $group: {
              _id: '$_id.date',
              data: {
                $push: {
                  channel: '$_id.channel',
                  keyword: '$_id.keywords',
                  keyword_sentiment: '$_id.keyword_sentiment',
                  keyword_tag: '$_id.keyword_tag',
                  tags: '$_id.tags',
                  sentiment: ['$_id.sentiment'],
                  count: '$count',
                  countMessage: '$countMessage',
                },
              },
              count: { $sum: '$count' },
            },
          },
        ]
        // console.log('{getChartData} :arr_aggregate #1:', JSON.stringify(arr_aggregate))
  
        temp_series = await mongodb.findAggregateOpts('social_messages', 'socialSchema', arr_aggregate, { hint })
      } else {
        let arr_aggregate = [
          ...advanceSearchFields,
          { $match: match },
          ...execute,
          {
            $group: {
              _id: {
                // channel: { $cond: [{ $eq: ['$channel', 'youtube'] }, 'youtube-post', '$channel'] },
                channel: {
                  $cond: {
                    if: { $eq: ['$channel', 'youtube'] },
                    then: 'youtube-post',
                    else: { $cond: { if: { $eq: ['$channel', 'website'] }, then: 'website-post', else: '$channel' } },
                  },
                },
                // keywords: '$keywords',
                keywords: { $cond: [{ $eq: ['$keywords', []] }, ['No Keyword'], '$keywords'] },
                keyword_sentiment: '$keyword_sentiment',
                keyword_tag: '$keyword_tag',
                tags: '$tags',
                hour: '$hour',
                sentiment: {
                  $cond: {
                    if: {
                      $in: ['$content.sentiment', ['positive', 'negative']],
                    },
                    then: '$content.sentiment',
                    else: 'neutral',
                  },
                },
                date: DATE_FILTER_GROUP,
              },
              // _id: { channel: '$channel', keywords: '$keywords', keyword_sentiment: '$keyword_sentiment', keyword_tag: '$keyword_tag', hour: '$hour' },
              count: { $sum: '$engagement' },
              countMessage: { $sum: 1 },
            },
          },
          {
            $group: {
              _id: { hour: '$_id.hour', date: '$_id.date' },
              // _id: {hour: '$_id.hour'},
              data: {
                $push: {
                  channel: '$_id.channel',
                  keyword: '$_id.keywords',
                  keyword_sentiment: '$_id.keyword_sentiment',
                  keyword_tag: '$_id.keyword_tag',
                  tags: '$_id.tags',
                  sentiment: ['$_id.sentiment'],
                  count: '$count',
                  countMessage: '$countMessage',
                },
              },
              count: { $sum: '$count' },
            },
          },
        ]
        // console.log('{getChartData} :arr_aggregate #2:', JSON.stringify(arr_aggregate))
  
        temp_series = await mongodb.findAggregateOpts('social_messages', 'socialSchema', arr_aggregate, { hint })
      }
  
      if (chartName) {
        try {
          switch (chartName) {
            case 'ShareKeyword':
              result = await getShareOfKeywordChart(temp_series, filter, keyword_name_maps, keywords)
              break
            case 'BuzzKeyword':
              result = await getBuzzKeywordChart(temp_series, filter, keyword_name_maps, keywords)
              break
            case 'ShareChannel':
              result = await getShareOfChannelChart(temp_series, filter, keyword_name_maps)
              break
            case 'ChannelKeyword':
              result = await getChannelByKeywordChart(temp_series, filter, keyword_name_maps, keywords)
              break
            case 'BuzzTimeTotal':
              result = await getBuzzTimelineByTotalChart(temp_series, filter, keyword_name_maps)
              break
            case 'ChannelChannel':
              result = await getChannelByChannelChart(temp_series, filter, keyword_name_maps)
              break
            case 'BuzzTimeChannel':
              result = await getBuzzTimelineByChannelChart(temp_series, filter, keyword_name_maps)
              break
            case 'ShareSentiment':
              result = await getShareOfSentimentChart(temp_series, filter, keyword_name_maps, easy_mode)
              break
            case 'SentimentOver':
              result = await getSentimentOverTimeChart(temp_series, filter, keyword_name_maps, easy_mode)
              break
            case 'ChannelSentiment':
              result = await getChannelBySentimentChart(temp_series, filter, keyword_name_maps, easy_mode)
              break
            case 'BuzzTimeTags':
              result = await getBuzzTimelineByTagsChart(temp_series, filter, tag_name_maps, easy_mode, tags)
              break
            case 'ShareTags':
              result = await getShareOfTagsChart(temp_series, filter, tag_name_maps, easy_mode, tags)
              break
            case 'ChannelTags':
              result = await getChannelByTagsChart(temp_series, filter, tag_name_maps, easy_mode, tags)
              break
            case 'SummaryChannel':
              result = await getSummaryChannel(temp_series, filter, tag_name_maps, easy_mode, metric)
              break
          }
        } catch (e) {
          console.log('[ERROR] getOverview - ', e.message)
        }
      } else {
        let [
          shareOfKeywordTopic,
          buzzTimelineByKeywordTopics,
          shareOfChannel,
          channelByKeyword,
          buzzTimelineByTotal,
          channelByChannel,
          buzzTimelineByChannel,
          shareOfSentiment,
          sentimentOverTime,
          channelBySentiment,
          buzzTimelineByTags,
          shareOfTags,
          channelByTags,
          summaryChannel,
        ] = await Promise.all([
          getShareOfKeywordChart(temp_series, filter, keyword_name_maps, keywords),
          getBuzzKeywordChart(temp_series, filter, keyword_name_maps, keywords),
          getShareOfChannelChart(temp_series, filter, keyword_name_maps),
          getChannelByKeywordChart(temp_series, filter, keyword_name_maps, keywords),
          getBuzzTimelineByTotalChart(temp_series, filter, keyword_name_maps),
          getChannelByChannelChart(temp_series, filter, keyword_name_maps),
          getBuzzTimelineByChannelChart(temp_series, filter, keyword_name_maps),
          getShareOfSentimentChart(temp_series, filter, keyword_name_maps, easy_mode),
          getSentimentOverTimeChart(temp_series, filter, keyword_name_maps, easy_mode),
          getChannelBySentimentChart(temp_series, filter, keyword_name_maps, easy_mode),
          getBuzzTimelineByTagsChart(temp_series, filter, tag_name_maps, easy_mode, tags),
          getShareOfTagsChart(temp_series, filter, tag_name_maps, easy_mode, tags),
          getChannelByTagsChart(temp_series, filter, tag_name_maps, easy_mode, tags),
          getSummaryChannel(temp_series, filter, keyword_name_maps, easy_mode, metric),
        ])
  
        result = {
          shareOfKeywordTopic,
          buzzTimelineByKeywordTopics,
          shareOfChannel,
          channelByKeyword,
          buzzTimelineByTotal,
          channelByChannel,
          buzzTimelineByChannel,
          shareOfSentiment,
          sentimentOverTime,
          channelBySentiment,
          buzzTimelineByTags,
          shareOfTags,
          channelByTags,
          summaryChannel,
        }
  
        if (!newtab) {
          await getQuickQuery(data.email, data.template_id, data, `overview.${data.metric}`, result)
        }
      }
  
      return result
    } catch (error) {
      console.error('getChartData error :', error)
      return error
    }
  }
  
  function getShareOfKeywordChart(queryResults, filter, keyword_name_maps, keyword_values) {
    try {
      let res = []
      let data = [].concat(
        ...queryResults.map((queryResult) => {
          return queryResult.data
        })
      )
      let keywords = []
  
      let checkNoKeyword = [...new Set([].concat(...data.map((data) => data.keyword)))].includes('No Keyword')
  
      if (filter.find.keywords) {
        // keywords = [...new Set([].concat(...data.map((data) => data.keyword)))].filter((k) => filter.find.keywords.includes(k))
        keywords = checkNoKeyword ? [...filter.find.keywords, 'No Keyword'] : filter.find.keywords
      } else {
        keywords = [...new Set([].concat(...data.map((data) => data.keyword)))]
      }
      keywords.sort()
      keywords = keywords.filter((arr) => arr !== 'Monitor')
  
      res = keywords.map((keyword) => {
        let y = data
          .filter((data) => {
            return data.keyword.includes(keyword)
          })
          .reduce((sum, arr) => sum + arr.count, 0)
  
        const _keyword = keyword_name_maps.find((k) => k._id == _.last(keyword.split('_')))
  
        let _color = _keyword?.color || null
        if (!_color) {
          const temp_keyword = keyword_values.find((k) => k.name == _.last(keyword.split('_')))
          _color = temp_keyword?.color || null
        }
  
        return { name: _keyword?.name || 'No Keyword', color: _color, y: y, fullLabel: keyword }
      })
  
      if (!filter.find.keywords) {
        res = clearEmptyData(res)
      } else {
        if (res.every((arr) => arr.y == 0)) {
          res = []
        }
      }
  
      return res
    } catch (error) {
      console.error('getShareOfKeywordChart error :', error)
      return error
    }
  }
  
  function getBuzzKeywordChart(queryResults, filter, keyword_name_maps, keyword_values) {
    let startDate = moment(filter.startDate)
    let endDate = moment(filter.endDate)
    let startDate_hour = startDate.hour()
    let temp_date = []
    let xAxis = { categories: [] }
    let series = []
    let diff_hour = endDate.diff(startDate, 'hour')
    let startingMoment = startDate.clone()
    let keywords = null
    let data = [].concat(
      ...queryResults.map((queryResult) => {
        return queryResult.data
      })
    )
  
    let checkNoKeyword = [...new Set([].concat(...data.map((data) => data.keyword)))].includes('No Keyword')
  
    if (filter.find.keywords) {
      // keywords = [...new Set([].concat(...data.map((data) => data.keyword)))].filter((k) => filter.find.keywords.includes(k))
      keywords = checkNoKeyword ? [...filter.find.keywords, 'No Keyword'] : filter.find.keywords
    } else {
      keywords = [...new Set([].concat(...data.map((data) => data.keyword)))]
    }
    keywords.sort()
    keywords = keywords.filter((arr) => arr !== 'Monitor')
  
    if (diff_hour > 120) {
      while (startingMoment <= endDate) {
        let date = startingMoment.format('YYYY-MM-DD')
        xAxis.categories.push(date)
        startingMoment.add(1, 'days')
        temp_date.push(0)
      }
      series = keywords.map((keyword) => {
        let data = []
  
        data = xAxis.categories.map((date) => {
          let d = queryResults.find((arr) => arr._id == date)
  
          let total = 0
  
          if (!d) {
            return total
          }
  
          total = d.data.filter((arr) => arr.keyword.includes(keyword)).reduce((sum, arr) => sum + arr.count, 0)
          return total
        })
  
        const _keyword = keyword_name_maps.find((k) => k._id == _.last(keyword.split('_')))
        let _color = _keyword?.color || null
        if (!_color) {
          const temp_keyword = keyword_values.find((k) => k.name == _.last(keyword.split('_')))
          _color = temp_keyword?.color || null
        }
  
        return {
          name: _keyword?.name || 'No Keyword',
          data: data,
          color: _color,
          fullLabel: keyword,
        }
      })
    } else {
      let temp_startDate = startDate.clone()
  
      for (let i = 0; i <= diff_hour; i++) {
        xAxis.categories.push(temp_startDate.format('YYYY-MM-DDTHH:mm:ss.SSSSZ'))
        temp_startDate.add(1, 'hour')
        temp_date.push(0)
      }
  
      series = keywords.map((keyword) => {
        let data = []
  
        for (let i = 0; i <= diff_hour; i++) {
          let hour = (i + startDate_hour) % 24
          let k = queryResults.find((arr) => arr._id.hour == hour && arr._id.date == moment(xAxis.categories[i]).format('YYYY-MM-DD'))
          let total = 0
  
          if (!k) {
            data.push(total)
          } else {
            total = k.data.filter((arr) => arr.keyword.includes(keyword)).reduce((sum, arr) => sum + arr.count, 0)
            data.push(total)
          }
        }
  
        const _keyword = keyword_name_maps.find((k) => k._id == _.last(keyword.split('_')))
        let _color = _keyword?.color || null
        if (!_color) {
          const temp_keyword = keyword_values.find((k) => k.name == _.last(keyword.split('_')))
          _color = temp_keyword?.color || null
        }
  
        return {
          name: _keyword?.name || 'No Keyword',
          data: data,
          color: _color,
          fullLabel: keyword,
        }
      })
    }
  
    // return { xAxis, series }
    let result = _.cloneDeep({ xAxis, series })
    // Check empty data
    result = clearEmptyData(result)
  
    // result.series = result.series.filter((serie) => !serie.data.every((s) => s == 0))
    // if (result.series.length > 0) {
    //   result.xAxis.categories = result.xAxis.categories.filter((cat, key) => {
    //     const isEmpty = result.series.map((item) => item.data[key]).every((item) => item == 0)
    //     if (isEmpty) {
    //       result.series = result.series.map((item, skey) => {
    //         let tmp = _.cloneDeep(item)
    //         delete tmp.data[key]
    //         return tmp
    //       })
    //     }
  
    //     return !isEmpty
    //   })
    //   result.series.map((item) => {
    //     item.data = item.data.filter((item) => item !== undefined)
    //     return item
    //   })
    // }
  
    return result
  }
  
  function getShareOfChannelChart(queryResults, filter, keyword_name_maps) {
    let res = []
    let data = [].concat(
      ...queryResults.map((data) => {
        return data.data
      })
    )
    let channels = []
    let keywords = []
  
    if (filter.find.channel) {
      channels = filter.find.channel
    } else {
      channels = [...new Set(data.map((arr) => arr.channel.split('-')[0]))]
    }
  
    if (filter.find.keywords) {
      // keywords = [...new Set([].concat(...data.map((data) => data.keyword)))].filter((k) => filter.find.keywords.includes(k))
      keywords = filter.find.keywords
    } else {
      keywords = [...new Set([].concat(...data.map((data) => data.keyword)))]
    }
    keywords.sort()
  
    res = channels.map((channel) => {
      let name = channel.replace('*', '')
  
      let y = data
        .filter((data) => {
          // return data.channel.includes(name) && data.keyword.filter((arr) => keywords.includes(arr)).length > 0
          return data.channel.includes(name)
        })
        .reduce((sum, arr) => sum + arr.count, 0)
      return {
        name: _.last(name.split('_')).replace('facebook-', 'facebookpage-'),
        y: y,
        fullLabel: `${name}*`,
      }
    })
  
    if (!filter.find.channel) {
      res = clearEmptyData(res)
    } else {
      if (res.every((arr) => arr.y == 0)) {
        res = []
      }
    }
  
    return res
  }
  
  function getChannelByKeywordChart(queryResults, filter, keyword_name_maps, keyword_values) {
    let xAxis = {}
    let series = []
    let channels = []
    let keywords = []
    let data = [].concat(
      ...queryResults.map((queryResult) => {
        return queryResult.data
      })
    )
    let checkNoKeyword = [...new Set([].concat(...data.map((data) => data.keyword)))].includes('No Keyword')
  
    if (filter.find.keywords) {
      keywords = checkNoKeyword ? [...filter.find.keywords, 'No Keyword'] : filter.find.keywords
      // keywords = [...new Set([].concat(...data.map((data) => data.keyword)))].filter((k) => filter.find.keywords.includes(k))
    } else {
      keywords = [...new Set([].concat(...data.map((data) => data.keyword)))]
    }
  
    keywords.sort()
    keywords = keywords.filter((arr) => arr !== 'Monitor')
  
    if (filter.find.channel) {
      channels = filter.find.channel
    } else {
      channels = [...new Set([].concat(...queryResults.map((arr) => arr.data.map((arr) => arr.channel.split('-')[0]))))]
    }
  
    xAxis = {
      categories: keywords.map((arr) => {
        if (arr === 'No Keyword') {
          return arr
        }
        return keyword_name_maps.find((k) => k._id == _.last(arr.split('_')))?.name
      }),
      categories2: keywords,
    }
  
    series = channels.map((channel) => {
      let name = channel.includes('*') ? channel.replace('*', '') : channel === 'facebook' ? 'facebook-' : channel === 'youtube' ? 'youtube-post' : channel
  
      let data = keywords.map((keyword) => {
        return []
          .concat(
            ...queryResults.map((arr) => {
              // return arr.data.filter((c) => c.channel.includes(name) && c.keyword.includes(keyword))
              return arr.data.filter((c) => c.channel.includes(name) && c.keyword.includes(keyword))
            })
          )
          .reduce((sum, arr) => sum + arr.count, 0)
      })
      return {
        name: name.replace('facebook-', 'facebookpage-').replace('youtube-post', 'youtube'),
        data: data,
        fullLabel: `${channel}*`,
      }
    })
    series = _.orderBy(series, 'name', 'desc')
  
    let result = _.cloneDeep({ xAxis, series })
    // Check empty data
    if (!filter.find.channel) {
      result = clearEmptyData(result)
    }
  
    // series = series.filter(serie => !serie.data.every(s => s == 0))
  
    return result
  }
  
  function getBuzzTimelineByTotalChart(queryResults, filter, keyword_name_maps) {
    let startDate = moment(filter.startDate)
    let endDate = moment(filter.endDate)
    let startDate_hour = startDate.hour()
    let diff_hour = endDate.diff(startDate, 'hour')
    let xAxis = {
      categories: [],
    }
    let series = []
    let data = []
  
    let datas = [].concat(
      ...queryResults.map((data) => {
        return data.data
      })
    )
  
    let checkNoKeyword = [...new Set([].concat(...datas.map((data) => data.keyword)))].includes('No Keyword')
  
    let keywords = []
    if (filter.find.keywords) {
      keywords = checkNoKeyword ? [...filter.find.keywords, 'No Keyword'] : filter.find.keywords
      // keywords = filter.find.keywords
      // keywords = [...new Set([].concat(...datas.map((data) => data.keyword)))].filter((k) => filter.find.keywords.includes(k))
    } else {
      keywords = [...new Set([].concat(...datas.map((data) => data.keyword)))]
    }
    keywords.sort()
  
    if (diff_hour > 120) {
      let startingMoment = startDate.clone()
      while (startingMoment <= endDate) {
        let date = startingMoment.format('YYYY-MM-DD')
        let count = 0
        xAxis.categories.push(date)
        let findCount = queryResults.find((arr) => arr._id == date)
  
        if (findCount) {
          count = findCount.data.reduce((sum, arr) => sum + arr.keyword.filter((arr) => keywords.includes(arr)).length * arr.count, 0)
        }
        data.push(count)
        startingMoment.add(1, 'days')
      }
    } else {
      let temp_startDate = startDate.clone()
      for (let i = 0; i <= diff_hour; i++) {
        let hour = (i + startDate_hour) % 24
        let count = 0
        xAxis.categories.push(temp_startDate.format('YYYY-MM-DDTHH:mm:ss.SSSSZ'))
  
        let findCount = queryResults.find((arr) => arr._id.hour == hour && arr._id.date == moment(xAxis.categories[i]).format('YYYY-MM-DD'))
  
        if (findCount) {
          // count = findCount.data.reduce((sum, arr) => sum + arr.keyword.length * arr.count, 0)
          count = findCount.data.reduce((sum, arr) => sum + arr.keyword.filter((arr) => keywords.includes(arr)).length * arr.count, 0)
          // count = findCount.data.reduce((sum, arr) => {
          //   let count = arr.count
          //   if (arr.keyword) {
          //     count = arr.keyword.filter((arr) => keywords.includes(arr)).length * arr.count
          //   }
          //   return sum + count
          // }, 0)
        }
        data.push(count)
        temp_startDate.add(1, 'hour')
      }
    }
  
    series.push({ name: 'Total', data: data })
  
    let result = _.cloneDeep({ xAxis, series })
    result = clearEmptyData(result)
  
    return result
  
    // if (data.every((arr) => arr == 0)) {
    //   series = []
    // } else {
    //   series.push({ name: 'Total', data: data })
    // }
    // return { xAxis, series }
  }
  function getBuzzTimelineByChannelChart(queryResults, filter, keyword_name_maps) {
    let startDate = moment(filter.startDate)
    let endDate = moment(filter.endDate)
    let startDate_hour = startDate.hour()
    let temp_date = []
    let xAxis = { categories: [] }
    let series = []
    let diff_hour = endDate.diff(startDate, 'hour')
    let startingMoment = startDate.clone()
    let channels = []
    let keywords = []
    let data = [].concat(
      ...queryResults.map((data) => {
        return data.data
      })
    )
  
    if (filter.find.channel) {
      channels = filter.find.channel
    } else {
      channels = [...new Set(data.map((arr) => arr.channel.split('-')[0]))]
    }
  
    let checkNoKeyword = [...new Set([].concat(...data.map((data) => data.keyword)))].includes('No Keyword')
  
    if (filter.find.keywords) {
      keywords = checkNoKeyword ? [...filter.find.keywords, 'No Keyword'] : filter.find.keywords
      // keywords = [...new Set([].concat(...data.map((data) => data.keyword)))].filter((k) => filter.find.keywords.includes(k))
    } else {
      keywords = [...new Set([].concat(...data.map((data) => data.keyword)))]
    }
    keywords.sort()
  
    if (diff_hour > 120) {
      while (startingMoment <= endDate) {
        let date = startingMoment.format('YYYY-MM-DD')
        xAxis.categories.push(date)
        startingMoment.add(1, 'days')
        temp_date.push(0)
      }
      series = channels.map((channel) => {
        let name = channel.replace('*', '')
        let data = []
  
        data = xAxis.categories.map((date) => {
          let d = queryResults.find((arr) => arr._id == date)
          let total = 0
  
          if (!d) {
            return total
          }
  
          total = d.data
            // .filter((arr) => arr.channel.split("-")[0] == channel)
            // .filter((arr) => arr.channel.includes(name) && arr.keyword.filter((k) => keywords.includes(k)).length > 0) // 7/05/2025
            .filter((arr) => arr.channel && arr.channel.includes(name))
            .reduce((sum, arr) => sum + arr.count, 0)
          return total
        })
  
        return {
          name: name.replace('facebook-', 'facebookpage-'),
          data: data,
          fullLabel: channel,
        }
      })
    } else {
      let temp_startDate = startDate.clone()
      for (let i = 0; i <= diff_hour; i++) {
        xAxis.categories.push(temp_startDate.format('YYYY-MM-DDTHH:mm:ss.SSSSZ'))
        temp_startDate.add(1, 'hour')
        temp_date.push(0)
      }
  
      series = channels.map((channel) => {
        let name = channel.replace('*', '')
        let data = []
  
        for (let i = 0; i <= diff_hour; i++) {
          let hour = (i + startDate_hour) % 24
          let k = queryResults.find((arr) => arr._id.hour == hour && arr._id.date == moment(xAxis.categories[i]).format('YYYY-MM-DD'))
  
          let total = 0
  
          if (!k) {
            data.push(total)
          } else {
            total = k.data
              // .filter((arr) => arr.channel.split("-")[0] == channel)
              // .filter((arr) => arr.channel.includes(name) && arr.keyword.filter((k) => keywords.includes(k)).length > 0) // 7/05/2025
              .filter((arr) => arr.channel && arr.channel.includes(name))
              .reduce((sum, arr) => sum + arr.count, 0)
            data.push(total)
          }
        }
  
        return {
          name: name.replace('facebook-', 'facebookpage-'),
          data: data,
          fullLabel: channel,
        }
      })
    }
  
    let result = _.cloneDeep({ xAxis, series })
    // result = clearEmptyData(result)
  
    return result
  
    // if (series.every((serie) => serie.data.every((data) => data == 0))) {
    //   series = []
    // }
  
    // // series = series.filter(serie => !serie.data.every(s => s == 0))
  
    // return { xAxis, series }
  }
  function getChannelByChannelChart(queryResults, filter, keyword_name_maps) {
    let res = []
    let data = [].concat(
      ...queryResults.map((data) => {
        return data.data
      })
    )
    let channels = []
    if (filter.find.channel) {
      channels = filter.find.channel
    } else {
      channels = [...new Set(data.map((arr) => arr.channel.split('-')[0]))]
    }
  
    let keywords = []
    let checkNoKeyword = [...new Set([].concat(...data.map((data) => data.keyword)))].includes('No Keyword')
  
    if (filter.find.keywords) {
      keywords = checkNoKeyword ? [...filter.find.keywords, 'No Keyword'] : filter.find.keywords
      // keywords = [...new Set([].concat(...data.map((data) => data.keyword)))].filter((k) => filter.find.keywords.includes(k))
    } else {
      keywords = [...new Set([].concat(...data.map((data) => data.keyword)))]
    }
    keywords.sort()
  
    res = channels.map((channel) => {
      let name = channel.replace('*', '')
      let y = data
        .filter((data) => {
          // return data.channel.includes(name) && data.keyword.filter((arr) => keywords.includes(arr)).length > 0
          return data.channel.includes(name)
        })
        .reduce((sum, arr) => sum + arr.count, 0)
      return {
        name: _.last(name.split('_')).replace('facebook-', 'facebookpage-'),
        data: [y],
        fullLabel: `${name}*`,
      }
    })
  
    res = _.orderBy(res, 'name', 'desc')
  
    // res = res.filter(serie => !serie.data.every(s => s == 0))
    // if (res.every((serie) => serie.data.every((data) => data == 0))) {
    //   res = []
    // }
  
    // return {
    //   xAxis: {
    //     categories: ['Total']
    //   },
    //   series: res
    // }
    let xAxis = { categories: ['Total'] }
    let series = res
    let result = _.cloneDeep({ xAxis, series })
  
    if (!filter.find.channel) {
      result = clearEmptyData(result)
    } else {
      if (result.series.every((serie) => serie.data.every((s) => s == 0))) {
        result.series = []
      }
    }
  
    return result
  }
  function getShareOfSentimentChart(queryResults, filter, keyword_name_maps, easy_mode) {
    try {
      let allSentiment = ['positive', 'neutral', 'negative']
      let res = []
      let datas = [].concat(
        ...queryResults.map((data) => {
          return data.data
        })
      )
      let sentiments = []
      if (!_.isEmpty(filter.find.sentiment)) {
        sentiments = filter.find.sentiment
      } else {
        sentiments = [...new Set([].concat(...datas.map((arr) => arr.keyword_sentiment.map((ks) => _.last(ks.split('§'))))))]
      }
  
      let keywords = []
      let checkNoKeyword = [...new Set([].concat(...datas.map((data) => data.keyword)))].includes('No Keyword')
      if (filter.find.keywords) {
        keywords = checkNoKeyword ? [...filter.find.keywords, 'No Keyword'] : filter.find.keywords
        // keywords = [...new Set([].concat(...datas.map((data) => data.keyword)))].filter((k) => filter.find.keywords.includes(k))
      } else {
        keywords = [...new Set([].concat(...datas.map((data) => data.keyword)))]
      }
      keywords.sort()
  
      // allSentiment = allSentiment.filter((arr) => sentiments.includes(arr))
      res = allSentiment.map((sentiment) => {
        let name = sentiment
        let y = datas
          .map((data) => {
            // let sm = data.keyword_sentiment
            //   .map((ks) => ks.split("§"))
            //   .filter((ks) => keywords.includes(ks[0]) && ks[1] == name).length;
            let sm = data.sentiment?.filter((ks) => ks == name).length
            return (easy_mode ? (sm > 0 ? 1 : 0) : sm) * data.count
          })
          .reduce((sum, arr) => sum + arr, 0)
  
        return { name: name, y: y }
      })
  
      if (res.every((arr) => arr.y == 0)) {
        res = []
      }
  
      // res = clearEmptyData(res)
  
      return res
    } catch (error) {
      console.error('getShareOfSentimentChart error :', error)
      return error
    }
  }
  function getSentimentOverTimeChart(queryResults, filter, keyword_name_maps, easy_mode) {
    try {
      let startDate = moment(filter.startDate)
      let endDate = moment(filter.endDate)
      let startDate_hour = startDate.hour()
      let temp_date = []
      let xAxis = { categories: [] }
      let series = []
      let diff_hour = endDate.diff(startDate, 'hour')
      let startingMoment = startDate.clone()
      let allSentiment = ['positive', 'neutral', 'negative']
      let datas = [].concat(
        ...queryResults.map((data) => {
          return data.data
        })
      )
      let sentiments = []
      if (!_.isEmpty(filter.find.sentiment)) {
        sentiments = filter.find.sentiment
      } else {
        sentiments = [...new Set([].concat(...datas.map((arr) => arr.keyword_sentiment.map((ks) => _.last(ks.split('§'))))))]
      }
      // allSentiment = allSentiment.filter((arr) => sentiments.includes(arr))
      // sentiments = allSentiment.filter((arr) => sentiments.includes(arr))
      sentiments = allSentiment
  
      let keywords = []
      if (filter.find.keywords) {
        keywords = filter.find.keywords
        // keywords = [...new Set([].concat(...datas.map((data) => data.keyword)))].filter((k) => filter.find.keywords.includes(k))
      } else {
        keywords = [...new Set([].concat(...datas.map((data) => data.keyword)))]
      }
      keywords.sort()
  
      if (diff_hour > 120) {
        while (startingMoment <= endDate) {
          let date = startingMoment.format('YYYY-MM-DD')
          xAxis.categories.push(date)
          startingMoment.add(1, 'days')
          temp_date.push(0)
        }
        series = sentiments.map((sentiment) => {
          let name = sentiment
          let data = []
  
          data = xAxis.categories.map((date) => {
            let d = queryResults.find((arr) => arr._id == date)
            let total = 0
  
            if (!d) {
              return total
            }
  
            total = d.data
              .map((arr) => {
                // let sm = arr.keyword_sentiment.map((ks) => ks.split('§')).filter((ks) => keywords.includes(ks[0]) && ks[1] == name)
                let sm = arr.sentiment?.filter((ks) => ks == name)
  
                return (easy_mode ? (sm.length > 0 ? 1 : 0) : sm.length) * arr.count
              })
              .reduce((sum, arr) => sum + arr, 0)
  
            return total
          })
  
          return {
            name: name,
            data: data,
            fullLabel: sentiment,
          }
        })
      } else {
        let temp_startDate = startDate.clone()
        for (let i = 0; i <= diff_hour; i++) {
          xAxis.categories.push(temp_startDate.format('YYYY-MM-DDTHH:mm:ss.SSSSZ'))
          temp_startDate.add(1, 'hour')
          temp_date.push(0)
        }
        series = sentiments.map((sentiment) => {
          let name = sentiment
          let data = []
  
          for (let i = 0; i <= diff_hour; i++) {
            let hour = (i + startDate_hour) % 24
            let k = queryResults.find((arr) => arr._id.hour == hour && arr._id.date == moment(xAxis.categories[i]).format('YYYY-MM-DD'))
            let total = 0
  
            if (!k) {
              data.push(total)
            } else {
              total = k.data
                .map((arr) => {
                  // let sm = arr.keyword_sentiment.map((ks) => ks.split('§')).filter((ks) => keywords.includes(ks[0]) && ks[1] == name)
                  let sm = arr.sentiment?.filter((ks) => ks == name)
  
                  return (easy_mode ? (sm.length > 0 ? 1 : 0) : sm.length) * arr.count
                })
                .reduce((sum, arr) => sum + arr, 0)
              data.push(total)
            }
          }
  
          return {
            name: name,
            data: data,
            fullLabel: sentiment,
          }
        })
      }
  
      let result = _.cloneDeep({ xAxis, series })
  
      // Check empty data
      if (result.series.every((serie) => serie.data.every((s) => s == 0))) {
        result.series = []
      }
      // result = clearEmptyData(result)
  
      return result
    } catch (error) {
      console.error('getSentimentOverTimeChart error :', error)
      return error
    }
  }
  function getChannelBySentimentChart(queryResults, filter, keyword_name_maps, easy_mode) {
    try {
      let allSentiment = ['positive', 'neutral', 'negative']
      let res = []
      let datas = [].concat(
        ...queryResults.map((data) => {
          return data.data
        })
      )
      let channels = []
      if (!_.isEmpty(filter.find.channel)) {
        channels = filter.find.channel
      } else {
        channels = [...new Set(datas.map((arr) => arr.channel.split('-')[0]))]
      }
  
      let sentiments = []
      if (!_.isEmpty(filter.find.sentiment)) {
        sentiments = filter.find.sentiment
      } else {
        sentiments = [...new Set([].concat(...datas.map((arr) => arr.keyword_sentiment.map((ks) => _.last(ks.split('§'))))))]
      }
      // allSentiment = allSentiment.filter((arr) => sentiments.includes(arr))
  
      let keywords = []
  
      if (filter.find.keywords) {
        keywords = filter.find.keywords
        // keywords = [...new Set([].concat(...datas.map((data) => data.keyword)))].filter((k) => filter.find.keywords.includes(k))
      } else {
        keywords = [...new Set([].concat(...datas.map((data) => data.keyword)))]
      }
      keywords.sort()
  
      res = channels.map((channel) => {
        let name = channel.replace('*', '')
        let k = datas.filter((data) => {
          return data.channel.includes(name)
        })
        let y = allSentiment.map((sentiment) => {
          return k
            .map((arr) => {
              // let sm = arr.keyword_sentiment.map((ks) => ks.split('§')).filter((ks) => keywords.includes(ks[0]) && ks[1] == sentiment).length
              let sm = arr.sentiment.filter((ks) => ks == sentiment).length
  
              return (easy_mode ? (sm > 0 ? 1 : 0) : sm) * arr.count
            })
            .reduce((sum, arr) => sum + arr, 0)
        })
  
        return {
          name: _.last(name.split('_')).replace('facebook-', 'facebookpage-'),
          data: y,
          fullLabel: `${name}*`,
        }
      })
  
      res = _.orderBy(res, 'name', 'desc')
      // res = res.filter(serie => !serie.data.every(s => s == 0))
  
      // return {
      //   xAxis: {
      //     categories: allSentiment
      //   },
      //   series: res
      // }
  
      let result = _.cloneDeep({ xAxis: { categories: allSentiment }, series: res })
  
      // Check empty data
      // if (result.series.every((serie) => serie.data.every((s) => s == 0))) {
      //   result.series = []
      // }
  
      if (_.isEmpty(filter.find.channel)) {
        result = clearEmptyData(result)
        // result.series = result.series.filter((serie) => !serie.data.every((s) => s == 0))
      }
  
      return result
    } catch (error) {
      console.error('getChannelBySentimentChart error :', error)
      return error
    }
  }
  function getBuzzTimelineByTagsChart(queryResults, filter, tag_name_maps, easy_mode, tag_values) {
    let key = easy_mode ? 'tags' : 'keyword_tag'
    let startDate = moment(filter.startDate)
    let endDate = moment(filter.endDate)
    let startDate_hour = startDate.hour()
    let temp_date = []
    let xAxis = { categories: [] }
    let series = []
    let diff_hour = endDate.diff(startDate, 'hour')
    let startingMoment = startDate.clone()
    let data = [].concat(
      ...queryResults.map((queryResult) => {
        return queryResult.data
      })
    )
    let keywords = []
  
    let checkNoKeyword = [...new Set([].concat(...data.map((data) => data.keyword)))].includes('No Keyword')
  
    if (filter.find.keywords) {
      keywords = checkNoKeyword ? [...filter.find.keywords, 'No Keyword'] : filter.find.keywords
      // keywords = [...new Set([].concat(...data.map((d) => d.keyword)))].filter((k) => filter.find.keywords.includes(k))
    } else {
      keywords = [...new Set([].concat(...data.map((d) => d.keyword)))]
    }
    keywords.sort()
  
    // Tags
    let tags = []
    if (filter.find.tags) {
      tags = filter.find.tags
    } else {
      // tags = easy_mode
      //   ? [...new Set([].concat(...data.map((d) => d.tags)))]
      //   : [
      //       ...new Set(
      //         [...new Set([].concat(...data.map((d) => d.keyword_tag)))]
      //           .filter((t) => {
      //             let tmp = keywords.filter((keyword) => {
      //               return t.split('§')[0].includes(keyword)
      //             })
      //             return tmp
      //           })
      //           .map((t) => t.split('§')[1])
      //       ),
      //     ]
      tags = [...new Set([].concat(...data.map((d) => d.tags)))]
    }
    // Exclude Tags
    if (filter.find.ex_tags) {
      let exTags = [...new Set(filter.find.ex_tags)]
      tags = tags.filter((tag) => !exTags.find((exTag) => exTag == tag))
    }
    tags.sort()
  
    if (diff_hour > 120) {
      while (startingMoment <= endDate) {
        let date = startingMoment.format('YYYY-MM-DD')
        xAxis.categories.push(date)
        startingMoment.add(1, 'days')
        temp_date.push(0)
      }
  
      series = _.compact(tags).map((tag) => {
        let data = []
  
        data = xAxis.categories.map((date) => {
          let d = queryResults.find((arr) => arr._id == date)
          let total = 0
          if (!d) {
            return total
          }
          total = d.data
            .filter((arr) => (arr[key] && arr[key].length ? arr[key].some((kt) => kt.indexOf(tag) >= 0) : false))
            .reduce((sum, arr) => sum + arr.count, 0)
          return total
        })
        let tag_name = tag.indexOf('§') >= 0 ? tag.split('§')[1].split('_') : tag.split('_')
        let name = tag_name
          .map((j) => {
            let tagObj = tag_name_maps.find((tag_map) => tag_map._id == j)
  
            if (tagObj) {
              return tagObj.name
            } else {
              return '(unknown)'
            }
          })
          .join(' : ')
  
        let last_tag = tag_name.pop()
        let find_tag_name_maps = tag_name_maps.find((tag_map) => tag_map._id == last_tag)
  
        let _color = null
        if (find_tag_name_maps?.color) {
          _color = find_tag_name_maps.color
        } else {
          const temp_tag = tag_values.find((k) => k.name == last_tag)
          _color = temp_tag?.color || null
        }
  
        return {
          name: name,
          data: data,
          color: _color,
          fullLabel: tag,
        }
      })
    } else {
      let temp_startDate = startDate.clone()
      for (let i = 0; i <= diff_hour; i++) {
        xAxis.categories.push(temp_startDate.format('YYYY-MM-DDTHH:mm:ss.SSSSZ'))
        temp_startDate.add(1, 'hour')
        temp_date.push(0)
      }
  
      if (tags.length > 0) {
        series = _.compact(tags).map((tag) => {
          let data = []
          for (let i = 0; i <= diff_hour; i++) {
            let hour = (i + startDate_hour) % 24
            let k = queryResults.find((arr) => arr._id.hour == hour && arr._id.date == moment(xAxis.categories[i]).format('YYYY-MM-DD'))
            let total = 0
            if (!k) {
              data.push(total)
            } else {
              total = k.data
                .filter((arr) => (arr[key] && arr[key].length ? arr[key].some((kt) => kt.indexOf(tag) >= 0) : false))
                .reduce((sum, arr) => sum + arr.count, 0)
              data.push(total)
            }
          }
          let tag_name = tag.indexOf('§') >= 0 ? tag.split('§')[1].split('_') : tag.split('_')
          let name = tag_name
            .map((j) => {
              let tagObj = tag_name_maps.find((tag_map) => tag_map._id == j)
  
              if (tagObj) {
                return tagObj.name
              } else {
                return '(unknown)'
              }
            })
            .join(' : ')
  
          let last_tag = tag_name.pop()
          let find_tag_name_maps = tag_name_maps.find((tag_map) => tag_map._id == last_tag)
  
          let _color = null
          if (find_tag_name_maps?.color) {
            _color = find_tag_name_maps.color
          } else {
            const temp_tag = tag_values.find((k) => k.name == last_tag)
            _color = temp_tag?.color || null
          }
  
          return {
            // name: tag_name.map((j) => tag_name_maps.find((tag_map) => tag_map._id == j)?.name || j).join(' : '),
            name: name,
            data: data,
            color: _color,
            fullLabel: tag,
          }
        })
      }
    }
  
    let result = _.cloneDeep({ xAxis, series })
    // Check empty data
    if (_.isEmpty(filter.find.tags)) {
      result = clearEmptyData(result)
    } else {
      if (result.series.every((serie) => serie.data.every((s) => s == 0))) {
        result.series = []
      }
    }
    return result
  }
  function getShareOfTagsChart(queryResults, filter, tag_name_maps, easy_mode, tag_values) {
    let key = easy_mode ? 'tags' : 'keyword_tag'
    let res = []
    let data = [].concat(
      ...queryResults.map((queryResult) => {
        return queryResult.data
      })
    )
  
    let keywords = []
    if (filter.find.keywords) {
      keywords = filter.find.keywords
      // keywords = [...new Set([].concat(...data.map((data) => data.keyword)))].filter((k) => filter.find.keywords.includes(k))
    } else {
      keywords = [...new Set([].concat(...data.map((data) => data.keyword)))]
    }
  
    // Tags
    let tags = []
    if (filter.find.tags) {
      tags = filter.find.tags
    } else {
      tags = easy_mode
        ? [...new Set([].concat(...data.map((d) => d.tags)))]
        : [
            ...new Set(
              [...new Set([].concat(...data.map((d) => d.keyword_tag)))]
                .filter((t) => {
                  let tmp = keywords.filter((keyword) => {
                    return t.split('§')[0].includes(keyword)
                  })
                  return tmp
                })
                .map((t) => t.split('§')[1])
            ),
          ]
    }
  
    // Exclude Tags
    if (filter.find.ex_tags) {
      let exTags = [...new Set(filter.find.ex_tags)]
      tags = tags.filter((tag) => !exTags.find((exTag) => exTag == tag))
    }
    tags.sort()
  
    if (!_.isEmpty(tags)) {
      res = _.compact(tags).map((label) => {
        let tag_name = label.indexOf('§') >= 0 ? label.split('§')[1].split('_') : label.split('_')
        let y = data
          .filter((data) => (data[key] && data[key].length ? data[key].some((kt) => kt.indexOf(label) >= 0) : false))
          .reduce((sum, arr) => sum + arr.count, 0)
        let name = tag_name
          .map((j) => {
            let tagObj = tag_name_maps.find((tag_map) => tag_map._id == j)
  
            if (tagObj) {
              return tagObj.name
            } else {
              return '(unknown)'
            }
          })
          .join(' : ')
  
        let last_tag = tag_name.pop()
        let find_tag_name_maps = tag_name_maps.find((tag_map) => tag_map._id == last_tag)
  
        let _color = null
        if (find_tag_name_maps?.color) {
          _color = find_tag_name_maps.color
        } else {
          const temp_tag = tag_values.find((k) => k.name == last_tag)
          _color = temp_tag?.color || null
        }
  
        return {
          name: name,
          y: y,
          color: _color,
          fullLabel: label,
        }
      })
    }
  
    if (_.isEmpty(filter.find.tags)) {
      res = clearEmptyData(res)
    } else {
      if (res.every((arr) => arr.y == 0)) {
        res = []
      }
    }
  
    return res
  }
  function getChannelByTagsChart(queryResults, filter, tag_name_maps, easy_mode, tag_values) {
    let key = easy_mode ? 'tags' : 'keyword_tag'
    let xAxis = {}
    let series = []
    let data = [].concat(
      ...queryResults.map((queryResult) => {
        return queryResult.data
      })
    )
  
    let keywords = []
    if (filter.find.keywords) {
      keywords = filter.find.keywords
      // keywords = [...new Set([].concat(...data.map((data) => data.keyword)))].filter((k) => filter.find.keywords.includes(k))
    } else {
      keywords = [...new Set([].concat(...data.map((data) => data.keyword)))]
    }
  
    // Tags
    let tags = []
    if (filter.find.tags) {
      tags = filter.find.tags
    } else {
      tags = easy_mode
        ? [...new Set([].concat(...data.map((d) => d.tags)))]
        : [
            ...new Set(
              [...new Set([].concat(...data.map((d) => d.keyword_tag)))]
                .filter((t) => {
                  let tmp = keywords.filter((keyword) => {
                    return t.split('§')[0].includes(keyword)
                  })
                  return tmp
                })
                .map((t) => t.split('§')[1])
            ),
          ]
    }
    // Exclude Tags
    if (filter.find.ex_tags) {
      let exTags = [...new Set(filter.find.ex_tags)]
      tags = tags.filter((tag) => !exTags.find((exTag) => exTag == tag))
    }
    tags.sort()
  
    let channels = []
    if (filter.find.channel) {
      channels = filter.find.channel
    } else {
      channels = [...new Set([].concat(...queryResults.map((arr) => arr.data.map((arr) => arr.channel.split('-')[0]))))]
    }
  
    xAxis = {
      categories: _.compact(tags).map((label) => {
        let tag_name = label.indexOf('§') >= 0 ? label.split('§')[1].split('_') : label.split('_')
        let name = tag_name
          .map((j) => {
            let tagObj = tag_name_maps.find((tag_map) => tag_map._id == j)
  
            if (tagObj) {
              return tagObj.name
            } else {
              return '(unknown)'
            }
          })
          .join(' : ')
        return name
      }),
      categories2: _.compact(tags).map((label) => {
        return label.indexOf('§') >= 0 ? label.split('§')[1] : label
      }),
    }
  
    series = channels.map((channel) => {
      tags = tags.filter((el) => el !== undefined)
      let name = channel.replace('*', '')
      let data_count = tags.map((label) => {
        let result = data.filter((data) =>
          data.channel.includes(name) && data[key] && data[key].length ? data[key].some((kt) => kt.indexOf(label) >= 0) : false
        )
        if (result.length > 0) {
          return result.reduce((sum, arr) => sum + arr.count, 0)
        } else {
          return
        }
      })
  
      return {
        name: name.replace('facebook-', 'facebookpage-'),
        data: data_count,
        fullLabel: `${channel}*`,
      }
    })
    series = _.orderBy(series, 'name', 'desc')
  
    let result = _.cloneDeep({ xAxis, series })
    // Check empty data
    if (_.isEmpty(filter.find.channel)) {
      result = clearEmptyData(result)
    }
    return result
  
    // result.series = result.series.filter((serie) => !serie.data.every((s) => s == 0))
    // if (result.series.length > 0) {
    //   result.xAxis.categories = result.xAxis.categories.filter((cat, key) => {
    //     const isEmpty = result.series.map((item) => item.data[key]).every((item) => item == 0)
    //     if (isEmpty) {
    //       result.series = result.series.map((item, skey) => {
    //         let tmp = _.cloneDeep(item)
    //         delete tmp.data[key]
    //         return tmp
    //       })
    //       delete result.xAxis.categories2[key]
    //     }
  
    //     return !isEmpty
    //   })
    //   result.xAxis.categories2 = result.xAxis.categories2.filter((item) => item !== undefined)
    //   result.series.map((item) => {
    //     item.data = item.data.filter((item) => item !== undefined)
    //     return item
    //   })
    // }
    // return { xAxis, series }
  }
  function getSummaryChannel(queryResults, filter, tag_name_maps, easy_mode, metric) {
    let res = []
    let data = [].concat(
      ...queryResults.map((data) => {
        return data.data
      })
    )
  
    let channels = []
    let keywords = []
  
    let checkNoKeyword = [...new Set([].concat(...data.map((data) => data.keyword)))].includes('No Keyword')
  
    if (filter.find.channel) {
      channels = filter.find.channel
    } else {
      channels = [...new Set(data.map((arr) => arr.channel.split('-')[0]))]
    }
  
    if (filter.find.keywords) {
      // keywords = [...new Set([].concat(...data.map((data) => data.keyword)))].filter((k) => filter.find.keywords.includes(k))
      keywords = checkNoKeyword ? [...filter.find.keywords, 'No Keyword'] : filter.find.keywords
    } else {
      keywords = [...new Set([].concat(...data.map((data) => data.keyword)))]
    }
    keywords.sort()
  
    res = channels.map((channel) => {
      let name = channel.includes('*') ? channel.replace('*', '') : channel === 'facebook' ? 'facebook-' : channel
  
      let message = data
        .filter((data) => {
          // return data.channel.includes(name) && data.keyword.filter((arr) => keywords.includes(arr)).length > 0
          return data.channel.includes(name)
        })
        .reduce((sum, arr) => sum + arr.countMessage, 0)
  
      let mention
      if (metric == 'engagement') {
        mention = data
          .filter((data) => {
            return data.channel.includes(name)
          })
          .reduce((sum, arr) => sum + arr.count, 0)
      } else {
        mention = keywords.map((keyword) => {
          return []
            .concat(
              ...queryResults.map((arr) => {
                return arr.data.filter((c) => c.channel.includes(name) && c.keyword.includes(keyword))
              })
            )
            .reduce((sum, arr) => sum + arr.count, 0)
        })
      }
  
      return {
        name: _.last(name.split('_')).replace('facebook-', 'facebook').replace('facebookgroup-', 'facebookgroup'),
        message,
        mention: metric == 'engagement' ? mention : mention.reduce((p, c) => p + c, 0),
        fullLabel: `${name}*`,
      }
    })
  
    const offlineChannel = ['newspaper', 'magazine', 'television', 'radio']
  
    let offline = _.remove(res, (r) => {
      const filterOnline = _.chain(offlineChannel)
        .map((i) => r.name.search(i) >= 0)
        .filter()
        .value()
      return filterOnline.length > 0 ? true : false
    })
    let online = res
    return { online, offline }
  }
  
  function clearEmptyData(data) {
    if (data.series) {
      if (data.series.every((serie) => serie.data.every((s) => s == 0))) {
        data.series = []
      }
  
      data.series = data.series.filter((serie) => {
        if (serie.data && serie.data.length) {
          return !serie.data.every((s) => s == 0)
        } else {
          return false
        }
      })
    } else {
      if (data.every((arr) => arr.y == 0)) {
        data = []
      }
      data = data.filter((item) => item.y != 0)
    }
  
    return data
  }