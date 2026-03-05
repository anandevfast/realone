//old route
router.post('/sentiment', sentimentController.getSentiment)

router.post('/sentimentCompare', async (req, res) => {
  let startDate = moment(req.body.startDate)
  let endDate = moment(req.body.endDate)

  let diff_hour = endDate.diff(startDate, 'hour')
  let find = req.body.find || {}
  let execute = engagement(req.body.metric)

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

  let temp_find = await fl.filterFormal(find, req.body.email)

  let filter = {
    find,
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
            date: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: { $toDate: '$publishedAtUnix' },
                timezone: '+07:00',
              },
            },
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
    // console.log(`arr_aggregate`, JSON.stringify(arr_aggregate))
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
            keywords: '$keywords',
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
          countMessage: { $sum: 1 },
        },
      },
    ]
    // console.log(`arr_aggregate2`, JSON.stringify(arr_aggregate))
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
    // keywords = keywords.filter((k) => filter.find.keywords.includes(k))
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
    : [...new Set([].concat(...compareData.map((arr) => arr.sentiment.map((sentiment) => _.last(sentiment.split('§'))))))]
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

  res.json({
    shareOfSentiment: fl.getPeriodComparePercentage('sentiment', compare_temp_series, { sentiments: allSentiment }),
    sentimentByKeyword: fl.getPeriodComparePercentage('sentiment', compare_temp_series, { keywords, sentiments: allSentiment }),
    sentimentByChannel: fl.getPeriodComparePercentage('sentiment', compare_temp_series, { sentiments: allSentiment, channels }),
    sentimentByCategory: fl.getPeriodComparePercentage('sentiment', compare_temp_series, { keywords, sentiments: allSentiment, category_tags, tags }),
    sentimentByTag: fl.getPeriodComparePercentage('sentiment', compare_temp_series, { keywords, sentiments: allSentiment, tags }),
  })
})

//old controller code
async function getSentiment(req, res) {
    let data = req.body
    data.keyword_name_maps = req.app.get('keyword_name_maps')
    data.tag_name_maps = req.app.get('tag_name_maps')
  
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
  
    let result = null
    result = await getChartData(data)
    res.json(result)
  }
  async function getChartData(data) {
    const keyword_name_maps = data.keyword_name_maps
    const tag_name_maps = data.tag_name_maps
    const keywords = data.keywords
    let result = null
    let startDate = moment(data.startDate)
    let endDate = moment(data.endDate)
    let diff_hour = endDate.diff(startDate, 'hour')
    let find = data.find || {}
    const newtab = data?.newtab == 1 ? 'newtab' : ''
  
    let parent = {}
    if (newtab) {
      parent = await mongodb.findById('social_messages', 'socialSchema', mongoose.Types.ObjectId(find.arr_id[0]))
  
      let channel = parent.channel
      let regex = /-comment|-subcomment|-retweet|-reply/gi
  
      if (!regex.test(channel)) find.code = [parent.code]
      find.newtab = { channel: channel }
    }
  
    let execute = engagement(data.metric)
    let temp_series = []
    let filter = {
      find: data.find || {},
      metric: data.metric || {},
      startDate: data.startDate || {},
      endDate: data.endDate || {},
      email: data.email,
    }
  
    let temp_find = await fl.filterFormal(find, data.email, newtab)
    const { match, hint, advanceSearchFields: advanceSearch } = await filterFormalV2(filter)
    const advanceSearchFields = !_.isEmpty(advanceSearch) ? [advanceSearch] : []
    let chartName = data.chartName
  
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
              date: {
                $dateToString: {
                  format: '%Y-%m-%d',
                  date: { $toDate: '$publishedAtUnix' },
                  timezone: '+07:00',
                },
              },
            },
            count: {
              $sum: '$engagement',
            },
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
            count: {
              $sum: '$count',
            },
          },
        },
      ]
  
      // console.log('arr_aggregate getChartData Sentiment:', JSON.stringify(arr_aggregate))
  
      temp_series = await mongodb.findAggregateOpts('social_messages', 'socialSchema', arr_aggregate, { hint })
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
              keywords: '$keywords',
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
              date: {
                $dateToString: {
                  format: '%Y-%m-%d',
                  date: { $toDate: '$publishedAtUnix' },
                  timezone: '+07:00',
                },
              },
            },
            count: {
              $sum: '$engagement',
            },
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
      // console.log('arr_aggregate getChartData Sentiment:2', JSON.stringify(arr_aggregate))
  
      temp_series = await mongodb.findAggregateOpts('social_messages', 'socialSchema', arr_aggregate, { hint })
    }
  
    if (chartName) {
      try {
        switch (chartName) {
          case 'ShareSentiment':
            result = await getShareOfSentimentChart(temp_series, filter)
            break
          case 'SentimentKeywordTopics':
            result = await getSentimentByKeywordTopicsChart(temp_series, filter, keyword_name_maps)
            break
          case 'netSentimentOverTime':
            result = await getSentimentOverTimeChart(temp_series, filter, keyword_name_maps, keywords)
            break
          case 'SentimentChannel':
            result = await getSentimentByChannelChart(temp_series, filter)
            break
          case 'SentimentCategory':
            result = await getSentimentByCategoryChart(temp_series, filter, tag_name_maps)
            break
          case 'SentimentTag':
            result = await getSentimentByTagChart(temp_series, filter, tag_name_maps)
            break
          case 'NetSentiment':
            result = await getNetSentimentChart(temp_series, filter, keyword_name_maps)
            break
          case 'NetSentimentTotal':
            result = await getNetSentimentByTotalChart(temp_series, filter, keyword_name_maps)
            break
          case 'NetSentimentChannel':
            result = await getNetSentimentByChannelChart(temp_series, filter, keyword_name_maps)
            break
          case 'CategoryNetSentiment':
            result = await getCategoryNetSentimentChart(temp_series, filter, tag_name_maps)
            break
          case 'TagNetSentiment':
            result = await getTagNetSentimentChart(temp_series, filter, tag_name_maps)
            break
        }
      } catch (e) {
        console.log('[ERROR] getSentiment - ', e.message)
      }
    } else {
      let [
        shareOfSentiment,
        sentimentByKeywordTopics,
        sentimentOverTime,
        sentimentByChannel,
        sentimentByCategory,
        sentimentByTag,
        netSentiment,
        netSentimentByTotal,
        netSentimentByChannel,
        categoryNetSentiment,
        tagNetSentiment,
      ] = await Promise.all([
        getShareOfSentimentChart(temp_series, filter),
        getSentimentByKeywordTopicsChart(temp_series, filter, keyword_name_maps),
        getSentimentOverTimeChart(temp_series, filter, keyword_name_maps, keywords),
        getSentimentByChannelChart(temp_series, filter),
        getSentimentByCategoryChart(temp_series, filter, tag_name_maps),
        getSentimentByTagChart(temp_series, filter, tag_name_maps),
        getNetSentimentChart(temp_series, filter, keyword_name_maps),
        getNetSentimentByTotalChart(temp_series, filter, keyword_name_maps),
        getNetSentimentByChannelChart(temp_series, filter, keyword_name_maps),
        getCategoryNetSentimentChart(temp_series, filter, tag_name_maps),
        getTagNetSentimentChart(temp_series, filter, tag_name_maps),
      ])
  
      result = {
        shareOfSentiment,
        sentimentByKeywordTopics,
        sentimentOverTime,
        sentimentByChannel,
        sentimentByCategory,
        sentimentByTag,
        netSentiment,
        netSentimentByTotal,
        netSentimentByChannel,
        categoryNetSentiment,
        tagNetSentiment,
      }
    }
  
    return result
  }
  function getShareOfSentimentChart(queryResults, filter) {
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
      // sentiments = [...new Set([].concat(...datas.map((arr) => arr.keyword_sentiment.map((ks) => _.last(ks.split('§'))))))]
      sentiments = [...new Set([].concat(...datas.map((arr) => arr.sentiment)))]
    }
  
    let keywords = []
    if (filter.find.keywords) {
      keywords = filter.find.keywords
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
          // let sm = data.keyword_sentiment.map((ks) => ks.split('§')).filter((ks) => keywords.includes(ks[0]) && ks[1] == name).length
          let sm = data.sentiment == name ? 1 : 0
          return sm * data.count
        })
        .reduce((sum, arr) => sum + arr, 0)
  
      return { name: name, y: y }
    })
  
    // if (res.every((arr) => arr.y == 0)) {
    //   res = []
    // }
  
    res = clearEmptyData(res, 'sentiment')
  
    return res
  }
  function getSentimentByKeywordTopicsChart(queryResults, filter, keyword_name_maps) {
    let xAxis = {}
    let series = []
  
    let allSentiment = ['positive', 'neutral', 'negative']
    let datas = [].concat(
      ...queryResults.map((data) => {
        return data.data
      })
    )
  
    // console.log('datas :', JSON.stringify(datas))
  
    let keywords = []
    if (filter.find.keywords) {
      keywords = filter.find.keywords
      keywords = [...new Set([].concat(...datas.map((data) => data.keyword)))].filter((k) => filter.find.keywords.includes(k))
    } else {
      keywords = [...new Set([].concat(...datas.map((data) => data.keyword)))]
    }
    keywords.sort()
    keywords = keywords.filter((arr) => arr !== 'Monitor')
  
    let sentiments = []
    if (!_.isEmpty(filter.find.sentiment)) {
      sentiments = filter.find.sentiment
    } else {
      // sentiments = [...new Set([].concat(...datas.map((arr) => arr.keyword_sentiment.map((ks) => _.last(ks.split('§'))))))]
      sentiments = [...new Set([].concat(...datas.map((arr) => arr.sentiment)))]
    }
    // allSentiment = allSentiment.filter((arr) => sentiments.includes(arr)).sort()
  
    xAxis = {
      // categories: keywords.map((arr) => keyword_name_maps.find((k) => k._id == _.last(arr.split('_'))).name),
      categories: keywords.map((arr) => keyword_name_maps.find((k) => k._id == _.last(arr.split('_')))),
      categories2: keywords.map((arr) => arr),
    }
  
    series = allSentiment.map((sentiment) => {
      let name = sentiment
      let data = keywords.map((keyword) => {
        let total = 0
        let keywordData = datas.filter((k) => k.keyword.includes(keyword))
  
        if (keywordData.length == 0) {
          return total
        }
  
        total = datas
          .map((d) => {
            // return d.count * d.keyword_sentiment.filter((ks) => _.last(ks.split('§')) == sentiment && ks.split('§')[0] == keyword).length
            return d.count * d.keyword.filter((k) => d.sentiment == name && k == keyword).length
          })
          .reduce((sum, arr) => sum + arr, 0)
  
        return total
      })
      return {
        name: name,
        data: data,
      }
    })
    series = _.orderBy(series, 'name', 'desc')
  
    // return { xAxis, series }
    let result = _.cloneDeep({ xAxis, series })
    // Check empty data
    // if (_.isEmpty(filter.find.keywords)) {
    //   result = clearEmptyData(result)
    // }
    return result
  }
  function getSentimentOverTimeChart(queryResults, filter, keyword_name_maps, keyword_values) {
    let startDate = moment(filter.startDate)
    let endDate = moment(filter.endDate)
    let startDate_hour = startDate.hour()
    let temp_date = []
    let xAxis = { categories: [] }
    let series = []
    let diff_hour = endDate.diff(startDate, 'hour')
    let startingMoment = startDate.clone()
  
    let datas = [].concat(
      ...queryResults.map((data) => {
        return data.data
      })
    )
    let keywords = []
    // let checkNoKeyword = [...new Set([].concat(...datas.map((data) => data.keyword)))].includes('No Keyword')
  
    if (filter.find.keywords) {
      keywords = filter.find.keywords
      // keywords = [...new Set([].concat(...datas.map((data) => data.keyword)))].filter((k) => filter.find.keywords.includes(k))
      // keywords = checkNoKeyword ? [...filter.find.keywords, 'No Keyword'] : filter.find.keywords
    } else {
      keywords = [...new Set([].concat(...datas.map((data) => data.keyword)))]
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
        let name = keyword
        let data = []
  
        data = xAxis.categories.map((date) => {
          let k = queryResults.find((arr) => arr._id == date)
          let total = 0
          let positive = 0
          let negative = 0
  
          if (!k) {
            return total
          } else {
            positive = k.data
              // .map((arr) => arr.keyword_sentiment.filter((ks) => _.last(ks.split('§')) == 'positive' && ks.split('§')[0] == keyword).length * arr.count)
              .filter((arr) => arr.keyword.includes(keyword))
              .map((arr) => arr.sentiment.filter((sentiment) => sentiment == 'positive').length * arr.count)
              .reduce((sum, arr) => sum + arr, 0)
            negative = k.data
              .filter((arr) => arr.keyword.includes(keyword))
              .map((arr) => arr.sentiment.filter((sentiment) => sentiment == 'negative').length * arr.count)
              .reduce((sum, arr) => sum + arr, 0)
  
            total = ((positive - negative) / (positive + negative)) * 100 || 0
  
            return parseFloat(total.toFixed(2))
          }
        })
  
        const _keyword = keyword_name_maps.find((k) => k._id == _.last(keyword.split('_')))
        let _color = _keyword?.color || null
        if (!_color) {
          const temp_keyword = keyword_values.find((k) => k.name == _.last(keyword.split('_')))
          _color = temp_keyword?.color || null
        }
  
        return {
          name: _keyword?.name,
          fullLabel: name,
          color: _color,
          data: data,
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
        let name = keyword
        let data = []
  
        for (let i = 0; i <= diff_hour; i++) {
          let hour = (i + startDate_hour) % 24
          // let k = queryResults.find((arr) => arr._id.hour == hour && arr._id.date == moment(xAxis.categories[i]).format('YYYY-MM-DD'))
          let k = queryResults.find((arr) => arr._id == hour)
          let total = 0
          let positive = 0
          let negative = 0
  
          if (!k) {
            data.push(total)
          } else {
            positive = k.data
              // .map((arr) => arr.keyword_sentiment.filter((ks) => _.last(ks.split('§')) == 'positive' && ks.split('§')[0] == keyword).length * arr.count)
              .filter((arr) => arr.keyword.includes(keyword))
              .map((arr) => arr.sentiment.filter((sentiment) => sentiment == 'positive').length * arr.count)
              .reduce((sum, arr) => sum + arr, 0)
            negative = k.data
              .filter((arr) => arr.keyword.includes(keyword))
              .map((arr) => arr.sentiment.filter((sentiment) => sentiment == 'negative').length * arr.count)
              .reduce((sum, arr) => sum + arr, 0)
  
            total = ((positive - negative) / (positive + negative)) * 100 || 0
  
            data.push(parseFloat(total.toFixed(2)))
          }
        }
  
        const _keyword = keyword_name_maps.find((k) => k._id == _.last(keyword.split('_')))
        let _color = _keyword?.color || null
        if (!_color) {
          const temp_keyword = keyword_values.find((k) => k.name == _.last(keyword.split('_')))
          _color = temp_keyword?.color || null
        }
  
        return {
          name: _keyword?.name,
          fullLabel: name,
          color: _color,
          data: data,
        }
      })
    }
  
    let result = _.cloneDeep({ xAxis, series })
  
    // Check empty data
    if (result.series.every((serie) => serie.data.every((s) => s == 0))) {
      result.series = []
    }
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
  function getSentimentByChannelChart(queryResults, filter) {
    let xAxis = {}
    let series = []
  
    let datas = [].concat(
      ...queryResults.map((data) => {
        return data.data
      })
    )
  
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
      channels = [...new Set(datas.map((arr) => arr.channel.split('-')[0]))]
    }
    channels.sort()
  
    let sentiments = []
    let allSentiment = ['positive', 'neutral', 'negative']
    sentiments = filter.find.sentiment
      ? filter.find.sentiment
      : [...new Set([].concat(...datas.map((arr) => arr.sentiment.map((sentiment) => _.last(sentiment.split('§'))))))]
    allSentiment = allSentiment.filter((arr) => sentiments.includes(arr))
  
    let keywords = []
    let checkNoKeyword = [...new Set([].concat(...datas.map((data) => data.keyword)))].includes('No Keyword')
    if (filter.find.keywords) {
      // keywords = keywords.filter((k) => filter.find.keywords.includes(k))
      keywords = checkNoKeyword ? [...filter.find.keywords, 'No Keyword'] : filter.find.keywords
    }
    keywords.sort()
    keywords = keywords.filter((arr) => arr !== 'Monitor')
  
    xAxis = {
      categories: channels.map((arr) => arr.replace('*', '')),
      categories2: channels.map((arr) => arr),
    }
  
    series = allSentiment.map((sentiment) => {
      let name = sentiment
      let data = xAxis.categories.map((channel) => {
        let total = 0
        let channelData = datas.filter((k) => {
          if (channel.split('-').length > 1) {
            return k.channel == channel
          } else {
            return k.channel.split('-')[0] == channel
          }
        })
  
        if (channelData.length == 0) {
          return total
        }
  
        total = channelData
          .map((d) => {
            return d.count * (d.sentiment == name ? 1 : 0)
            // d.keyword_sentiment.filter((ks) => {
            //   let split = ks.split('§')
            //   return keywords.includes(split[0]) && split[1] == name
            // }).length
          })
          .reduce((sum, arr) => sum + arr, 0)
  
        return total
      })
      return {
        name: name,
        data: data,
      }
    })
    series = _.orderBy(series, 'name', 'desc')
  
    let result = _.cloneDeep({ xAxis, series })
    // Check empty data
    result = clearEmptyData(result)
    // if (_.isEmpty(filter.find.channel)) {
    // } else {
  
    // }
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
    return result
  }
  function getSentimentByCategoryChart(queryResults, filter, tag_name_maps) {
    let xAxis = {}
    let series = []
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
      // sentiments = [...new Set([].concat(...datas.map((arr) => arr.keyword_sentiment.map((ks) => _.last(ks.split('§'))))))]
      sentiments = [...new Set([].concat(...datas.map((arr) => arr.sentiment)))]
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
    keywords = keywords.filter((arr) => arr !== 'Monitor')
  
    // Tags
    let tags = []
    if (filter.find.tags) {
      tags = filter.find.tags
    } else {
      tags = [...new Set([].concat(...datas.map((data) => data.tags)))]
      // tags = [
      //   ...new Set(
      //     [...new Set([].concat(...datas.map((d) => d.keyword_tag)))]
      //       .filter((t) => {
      //         let tmp = keywords.filter((keyword) => {
      //           return t.split('§')[0].includes(keyword)
      //         })
      //         return tmp
      //       })
      //       .map((t) => t.split('§')[1])
      //   ),
      // ]
    }
    // Exclude Tags
    if (filter.find.ex_tags) {
      let exTags = [...new Set(filter.find.ex_tags)]
      tags = tags.filter((tag) => !exTags.find((exTag) => exTag == tag))
    }
  
    tags = _.compact(tags)
    tags.sort()
  
    // Filter Tag Group
    let tagCats = []
    if (!_.isEmpty(tags)) {
      tagCats = [...new Set(tags.map((t) => t.split('_')[0]))]
      console.log('tagCats :', JSON.stringify(tagCats))
  
      tagCats = _.compact(tagCats)
      tagCats.sort()
    }
  
    xAxis = {
      categories: tagCats.map((arr) => convertTagIdToText(arr, tag_name_maps)),
      categories2: tagCats.map((cat) => tags.filter((tag) => tag.includes(cat))),
    }
  
    series = allSentiment.map((sentiment) => {
      let name = sentiment
  
      let dataHaveTag = datas.filter((d) => {
        // let ks = d.keyword_sentiment.map((ks) => {
        //   return ks.split('§')
        // })
        let ks = d.sentiment
  
        // matching keyword
        // let matchKeywords = ks.filter((arr) => keywords.includes(arr[0]))
        // matching sentiment
        // let matchSentiment = matchKeywords.filter((arr) => arr[1] == name)
  
        // return matchSentiment.length > 0 && d.keyword_tag.length > 0
        return ks == name && tags.length > 0
      })
  
      let data = tagCats.map((tc) => {
        return dataHaveTag
          .map((d) => {
            let total = 0
            // total =
            //   d.keyword_tag.filter((kt) => {
            //     let split = kt.split('§')[1].split('_')
            //     return split[0] == tc && tags.includes(kt.split('§')[1])
            //   }).length * d.count
            d.tags = _.compact(d.tags)
  
            total =
              d.tags.filter((tag) => {
                let split = tag.split('_')
                return split[0] == tc
              }).length * d.count
            return total
          })
          .reduce((sum, arr) => sum + arr, 0)
      })
      return {
        name: name,
        data: data,
      }
    })
  
    let result = _.cloneDeep({ xAxis, series })
    // Check empty data
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
    return result
  }
  function getSentimentByTagChart(queryResults, filter, tag_name_maps) {
    let xAxis = {}
    let series = []
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
      // sentiments = [...new Set([].concat(...datas.map((arr) => arr.keyword_sentiment.map((ks) => _.last(ks.split('§'))))))]
      sentiments = [...new Set([].concat(...datas.map((arr) => arr.sentiment)))]
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
    keywords = keywords.filter((arr) => arr !== 'Monitor')
  
    // Tags
    let tags = []
    if (filter.find.tags) {
      tags = filter.find.tags
    } else {
      tags = [...new Set([].concat(...datas.map((data) => data.tags)))]
      // tags = [
      //   ...new Set(
      //     [...new Set([].concat(...datas.map((d) => d.keyword_tag)))]
      //       .filter((t) => {
      //         let tmp = keywords.filter((keyword) => {
      //           return t.split('§')[0].includes(keyword)
      //         })
      //         return tmp
      //       })
      //       .map((t) => t.split('§')[1])
      //   ),
      // ]
    }
    // Exclude Tags
    if (filter.find.ex_tags) {
      let exTags = [...new Set(filter.find.ex_tags)]
      tags = tags.filter((tag) => !exTags.find((exTag) => exTag == tag))
    }
    tags.sort()
  
    xAxis = {
      categories: tags.map((arr) => convertTagIdToText(arr, tag_name_maps)),
      categories2: tags,
    }
  
    series = allSentiment.map((sentiment) => {
      let name = sentiment
  
      let dataHaveTag = datas.filter((d) => {
        // let ks = d.keyword_sentiment.map((ks) => {
        //   return ks.split('§')
        // })
        let ks = d.sentiment
  
        // matching keyword
        // let matchKeywords = ks.filter((arr) => keywords.includes(arr[0]))
        // matching sentiment
        // let matchSentiment = matchKeywords.filter((arr) => arr[1] == name)
  
        // return matchSentiment.length > 0 && d.keyword_tag.length > 0
        return ks == name && tags.length > 0
      })
  
      let data = tags.map((t) => {
        return dataHaveTag
          .map((d) => {
            let total = 0
            // total = d.keyword_tag.filter((kt) => kt.split('§')[1] == t).length * d.count
            total = d.tags.filter((tag) => tag == t).length * d.count
            return total
          })
          .reduce((sum, arr) => sum + arr, 0)
      })
      return {
        name: name,
        data: data,
      }
    })
  
    let result = _.cloneDeep({ xAxis, series })
    // result = clearEmptyData(result, 'sentiment')
    // Check empty data
    // result.series = result.series.filter((serie) => !serie.data.every((s) => s == 0))
    if (_.isEmpty(filter.find.tags)) {
      if (result.series.length > 0) {
        result.xAxis.categories = result.xAxis.categories.filter((cat, key) => {
          const isEmpty = result.series.map((item) => item.data[key]).every((item) => item == 0)
          if (isEmpty) {
            result.series = result.series.map((item, skey) => {
              let tmp = _.cloneDeep(item)
              delete tmp.data[key]
              return tmp
            })
            delete result.xAxis.categories2[key]
          }
  
          return !isEmpty
        })
        result.xAxis.categories2 = result.xAxis.categories2.filter((item) => item !== undefined)
        result.series.map((item) => {
          item.data = item.data.filter((item) => item !== undefined)
          return item
        })
      }
    }
    return result
  }
  function getNetSentimentChart(queryResults, filter, keyword_name_maps) {
    let res = []
    let dataQuery = [].concat(
      ...queryResults.map((data) => {
        return data.data
      })
    )
    let sentiments = []
    if (!_.isEmpty(filter.find.sentiment)) {
      sentiments = filter.find.sentiment
    } else {
      sentiments = [...new Set([].concat(...dataQuery.map((arr) => arr.keyword_sentiment.map((ks) => _.last(ks.split('§'))))))]
    }
  
    let keywords = []
    if (filter.find.keywords) {
      keywords = filter.find.keywords
      // keywords = [...new Set([].concat(...dataQuery.map((data) => data.keyword)))].filter((k) => filter.find.keywords.includes(k))
    } else {
      keywords = [...new Set([].concat(...dataQuery.map((data) => data.keyword)))]
    }
    keywords.sort()
    keywords = keywords.filter((arr) => arr !== 'Monitor')
  
    for (let keyword of keywords) {
      let filterKeyword = dataQuery.filter((data) => data.keyword.includes(keyword))
      let positive = 0
      let negative = 0
      let diffSentiment = 0
  
      let sentiments = filterKeyword.map((item) => {
        let positive = 0
        let negative = 0
        let sentiments = item.keyword_sentiment.filter((ks) => ks.split('§')[0] == keyword).map((ks) => _.last(ks.split('§')))
  
        positive = sentiments.filter((s) => s == 'positive').length * item.count
        negative = sentiments.filter((s) => s == 'negative').length * item.count
  
        return { positive, negative }
      })
  
      positive = sentiments.reduce((sum, arr) => sum + arr.positive, 0)
      negative = sentiments.reduce((sum, arr) => sum + arr.negative, 0)
  
      diffSentiment = ((positive - negative) / (positive + negative)) * 100 || 0
  
      res.push({
        name: keyword_name_maps.find((k) => k._id == _.last(keyword.split('_')))?.name,
        value: diffSentiment,
      })
    }
  
    return res
  }
  function getNetSentimentByTotalChart(queryResults, filter, keyword_name_maps) {
    return null
  }
  function getNetSentimentByChannelChart(queryResults, filter, keyword_name_maps) {
    return null
  }
  function getCategoryNetSentimentChart(queryResults, filter, tag_name_maps) {
    let result = []
    let allSentiment = ['positive', 'neutral', 'negative']
    let queryData = [].concat(
      ...queryResults.map((data) => {
        return data.data
      })
    )
  
    let sentiments = []
    if (!_.isEmpty(filter.find.sentiment)) {
      sentiments = filter.find.sentiment
    } else {
      // sentiments = [...new Set([].concat(...queryData.map((arr) => arr.keyword_sentiment.map((ks) => _.last(ks.split('§'))))))]
      sentiments = [...new Set([].concat(...queryData.map((arr) => arr.sentiment)))]
    }
    allSentiment = allSentiment.filter((arr) => sentiments.includes(arr))
  
    let keywords = []
    if (filter.find.keywords) {
      keywords = filter.find.keywords
      // keywords = [...new Set([].concat(...queryData.map((data) => data.keyword)))].filter((k) => filter.find.keywords.includes(k))
    } else {
      keywords = [...new Set([].concat(...queryData.map((data) => data.keyword)))]
    }
    keywords.sort()
    keywords = keywords.filter((arr) => arr !== 'Monitor')
  
    // Tags
    let tags = []
    if (filter.find.tags) {
      tags = filter.find.tags
    } else {
      tags = [...new Set([].concat(...queryData.map((data) => data.tags)))]
      // tags = [
      //   ...new Set(
      //     [...new Set([].concat(...queryData.map((data) => data.keyword_tag)))]
      //       .filter((t) => {
      //         let tmp = keywords.filter((keyword) => {
      //           return t.split('§')[0].includes(keyword)
      //         })
      //         return tmp
      //       })
      //       .map((t) => t.split('§')[1])
      //   ),
      // ]
    }
    // Exclude Tags
    if (filter.find.ex_tags) {
      let exTags = [...new Set(filter.find.ex_tags)]
      tags = tags.filter((tag) => !exTags.find((exTag) => exTag == tag))
    }
    tags.sort()
  
    // Filter Tag Group
    let tagCats = [...new Set(tags.map((t) => t.split('_')[0]))]
    tagCats.sort()
  
    let series = []
    series = allSentiment.map((sentiment) => {
      let name = sentiment
  
      let dataHaveTag = queryData.filter((d) => {
        // let ks = d.keyword_sentiment.map((ks) => {
        //   return ks.split('§')
        // })
        let ks = d.sentiment
  
        // matching keyword
        // let matchKeywords = ks.filter((arr) => keywords.includes(arr[0]))
        // matching sentiment
        // let matchSentiment = matchKeywords.filter((arr) => arr[1] == name)
  
        // return matchSentiment.length > 0 && d.keyword_tag.length > 0
        return ks == name && tags.length > 0
      })
  
      let data = tagCats.map((tc) => {
        return dataHaveTag
          .map((d) => {
            let total = 0
            // total =
            //   d.keyword_tag.filter((kt) => {
            //     let split = kt.split('§')[1].split('_')
            //     return split[0] == tc && tags.includes(kt.split('§')[1])
            //   }).length * d.count
            total =
              d.tags.filter((tag) => {
                let split = tag.split('_')
                return split[0] == tc
              }).length * d.count
            return total
          })
          .reduce((sum, arr) => sum + arr, 0)
      })
      return {
        name: name,
        data: data,
      }
    })
  
    for (const key in tagCats) {
      let positive = 0
      let negative = 0
      positive = series.find((s) => s.name == 'positive')?.data[key] || 0
      negative = series.find((s) => s.name == 'negative')?.data[key] || 0
  
      result.push({
        name: convertTagIdToText(tagCats[key], tag_name_maps),
        value: ((positive - negative) / (positive + negative)) * 100 || 0,
      })
    }
  
    return result
  }
  function getTagNetSentimentChart(queryResults, filter, tag_name_maps) {
    let result = []
    let allSentiment = ['positive', 'neutral', 'negative']
    let queryData = [].concat(
      ...queryResults.map((data) => {
        return data.data
      })
    )
  
    let sentiments = []
    if (!_.isEmpty(filter.find.sentiment)) {
      sentiments = filter.find.sentiment
    } else {
      // sentiments = [...new Set([].concat(...queryData.map((arr) => arr.keyword_sentiment.map((ks) => _.last(ks.split('§'))))))]
      sentiments = [...new Set([].concat(...queryData.map((arr) => arr.sentiment)))]
    }
    allSentiment = allSentiment.filter((arr) => sentiments.includes(arr))
  
    let keywords = []
    if (filter.find.keywords) {
      keywords = filter.find.keywords
      // keywords = [...new Set([].concat(...queryData.map((data) => data.keyword)))].filter((k) => filter.find.keywords.includes(k))
    } else {
      keywords = [...new Set([].concat(...queryData.map((data) => data.keyword)))]
    }
    keywords.sort()
    keywords = keywords.filter((arr) => arr !== 'Monitor')
  
    // Tags
    let tags = []
    if (filter.find.tags) {
      tags = filter.find.tags
    } else {
      tags = [...new Set([].concat(...queryData.map((data) => data.tags)))]
      // tags = [
      //   ...new Set(
      //     [...new Set([].concat(...queryData.map((data) => data.keyword_tag)))]
      //       .filter((t) => {
      //         let tmp = keywords.filter((keyword) => {
      //           return t.split('§')[0].includes(keyword)
      //         })
      //         return tmp
      //       })
      //       .map((t) => t.split('§')[1])
      //   ),
      // ]
    }
    // Exclude Tags
    if (filter.find.ex_tags) {
      let exTags = [...new Set(filter.find.ex_tags)]
      tags = tags.filter((tag) => !exTags.find((exTag) => exTag == tag))
    }
    tags.sort()
  
    let series = []
    series = allSentiment.map((sentiment) => {
      let name = sentiment
  
      let dataHaveTag = queryData.filter((d) => {
        // let ks = d.keyword_sentiment.map((ks) => {
        //   return ks.split('§')
        // })
        let ks = d.sentiment
  
        // matching keyword
        // let matchKeywords = ks.filter((arr) => keywords.includes(arr[0]))
        // matching sentiment
        // let matchSentiment = matchKeywords.filter((arr) => arr[1] == name)
  
        // return matchSentiment.length > 0 && d.keyword_tag.length > 0
        return ks == name && tags.length > 0
      })
  
      let data = tags.map((t) => {
        return dataHaveTag
          .map((d) => {
            let total = 0
            // total = d.keyword_tag.filter((kt) => kt.split('§')[1] == t).length * d.count
            total = d.tags.filter((tag) => tag == t).length * d.count
            return total
          })
          .reduce((sum, arr) => sum + arr, 0)
      })
      return {
        name: name,
        data: data,
      }
    })
  
    for (const key in tags) {
      let positive = 0
      let negative = 0
      positive = series.find((s) => s.name == 'positive')?.data[key] || 0
      negative = series.find((s) => s.name == 'negative')?.data[key] || 0
  
      result.push({
        name: convertTagIdToText(tags[key], tag_name_maps).split('_')[0],
        subname: convertTagIdToText(tags[key], tag_name_maps).split('_')[1],
        value: ((positive - negative) / (positive + negative)) * 100 || 0,
      })
    }
  
    return result
  }
  
  function convertTagIdToText(tag, tag_name_maps) {
    if (tag_name_maps == null) {
      return tag
    }
  
    return tag
      .split('_')
      .map((t) => {
        let theTag = tag_name_maps.find((arr) => arr._id == t)
        if (theTag == null) {
          return t
        } else {
          return theTag.name
        }
      })
      .join('_')
  }
  function clearEmptyData(data, type) {
    if (data.series) {
      if (data.series.every((serie) => serie.data.every((s) => s == 0))) {
        data.series = []
      }
  
      data.series = data.series.filter((serie) => !serie.data.every((s) => s == 0))
    } else {
      if (data.every((arr) => arr.y == 0)) {
        data = []
      }
  
      if (type != 'sentiment') {
        data = data.filter((item) => item.y != 0)
      }
    }
  
    return data
  }
  