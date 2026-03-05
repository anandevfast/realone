//old route

router.post('/influencer', influencerController.getInfluencer)

router.post('/topInfluencer', async (req, res) => {
  let data = {
    startDate: moment(req.body.startDate),
    endDate: moment(req.body.endDate),
    find: req.body.find || {},
    email: req.body.email,
    metric: req.body.metric,
  }
  let result = await controller.getTopInfluencer(data)

  if (req.body?.api_mobile) return res.json({ code: 200, status: 'successful', result: result })
  res.json(result)
})

router.post('/topInfluencerPrevious', async (req, res) => {
  let data = {
    startDate: moment(req.body.startDate),
    endDate: moment(req.body.endDate),
    find: req.body.find || {},
    email: req.body.email,
    id_arr: req.body.id_arr,
  }
  let result = await controller.getTopInfluencerPrevious(data)

  if (req.body?.api_mobile) return res.json({ code: 200, status: 'successful', result: result })
  res.json(result)
})

//old controller code


async function getInfluencer(req, res) {
    let data = req.body
    data.keyword_name_maps = req.app.get('keyword_name_maps')
    data.tag_name_maps = req.app.get('tag_name_maps')
    let result = null
    result = await getChartData(data)
    res.json(result)
  }
  async function getChartData(data) {
    const keyword_name_maps = data.keyword_name_maps
    const tag_name_maps = data.tag_name_maps
    let result = null
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
  
    let temp_find = await fl.filterFormal(find, data.email, newtab)
    let obj_result = []
    let filter = {
      find: data.find || {},
      metric: data.metric || {},
      startDate: data.startDate || {},
      endDate: data.endDate || {},
      email: data.email,
    }
    let chartName = data.chartName
  
    const { match, hint, advanceSearchFields: advanceSearch } = await filterFormalV2(filter)
    const advanceSearchFields = !_.isEmpty(advanceSearch) ? [advanceSearch] : []
    let arr_aggregate = [
      ...advanceSearchFields,
      { $match: match },
      {
        $project: {
          channel: '$channel',
          keywords: '$keywords',
          keyword_sentiment: '$keyword_sentiment',
          keyword_tag: '$keyword_tag',
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
          name: {
            $ifNull: [
              '$content.from.name',
              { $ifNull: ['$content.user.name', { $ifNull: ['$content.author', { $ifNull: ['$content.user.username', '$content.username'] }] }] },
            ],
          },
          domain: '$domain',
        },
      },
      {
        $group: {
          _id: {
            channel: '$channel',
            keywords: '$keywords',
            keyword_sentiment: '$keyword_sentiment',
            keyword_tag: '$keyword_tag',
            sentiment: '$sentiment',
          },
  
          arr_name: { $addToSet: '$name' },
          arr_domain: { $addToSet: '$domain' },
        },
      },
    ]
    // console.log('arr_aggregate :', JSON.stringify(arr_aggregate))
  
    obj_result = await mongodb.findAggregateOpts('social_messages', 'socialSchema', arr_aggregate, { hint })
  
    if (chartName) {
      try {
        switch (chartName) {
          case 'UniqueAuthorsTopic':
            result = await getUniqueAuthorsByKeywordChart(obj_result, filter, keyword_name_maps)
            break
          case 'UniqueSitesTopic':
            result = await getUniqueSitesByKeywordChart(obj_result, filter, keyword_name_maps)
            break
          case 'UniqueAuthorsChannel':
            result = await getUniqueAuthorsByChannelChart(obj_result, filter, keyword_name_maps)
            break
          case 'UniqueSitesChannel':
            result = await getUniqueSitesByChannelChart(obj_result, filter, keyword_name_maps)
            break
          case 'UniqueAuthorsSentiment':
            result = await getUniqueAuthorsBySentimentChart(obj_result, filter, keyword_name_maps)
            break
          case 'UniqueSitesSentiment':
            result = await getUniqueSitesBySentimentChart(obj_result, filter, keyword_name_maps)
            break
          case 'UniqueAuthorsCategory':
            result = await getUniqueAuthorsByCategoryChart(obj_result, filter, tag_name_maps)
            break
          case 'UniqueSitesCategory':
            result = await getUniqueSitesByCategoryChart(obj_result, filter, tag_name_maps)
            break
          case 'UniqueAuthorsTags':
            result = await getUniqueAuthorsByTagsChart(obj_result, filter, tag_name_maps)
            break
          case 'UniqueSitesTags':
            result = await getUniqueSitesByTagsChart(obj_result, filter, tag_name_maps)
            break
        }
      } catch (e) {
        console.log('[ERROR] getSentiment - ', e.message)
      }
    } else {
      let [
        uniqueAuthorsByKeyword,
        uniqueSitesByKeyword,
        uniqueAuthorsByChannel,
        uniqueSitesByChannel,
        uniqueAuthorsBySentiment,
        uniqueSitesBySentiment,
        uniqueAuthorsByCategory,
        uniqueSitesByCategory,
        uniqueAuthorsByTags,
        uniqueSitesByTags,
      ] = await Promise.all([
        getUniqueAuthorsByKeywordChart(obj_result, filter, keyword_name_maps),
        getUniqueSitesByKeywordChart(obj_result, filter, keyword_name_maps),
        getUniqueAuthorsByChannelChart(obj_result, filter, keyword_name_maps),
        getUniqueSitesByChannelChart(obj_result, filter, keyword_name_maps),
        getUniqueAuthorsBySentimentChart(obj_result, filter, keyword_name_maps),
        getUniqueSitesBySentimentChart(obj_result, filter, keyword_name_maps),
        getUniqueAuthorsByCategoryChart(obj_result, filter, tag_name_maps),
        getUniqueSitesByCategoryChart(obj_result, filter, tag_name_maps),
        getUniqueAuthorsByTagsChart(obj_result, filter, tag_name_maps),
        getUniqueSitesByTagsChart(obj_result, filter, tag_name_maps),
      ])
  
      result = {
        uniqueAuthorsByKeyword,
        uniqueSitesByKeyword,
        uniqueAuthorsByChannel,
        uniqueSitesByChannel,
        uniqueAuthorsBySentiment,
        uniqueSitesBySentiment,
        uniqueAuthorsByCategory,
        uniqueSitesByCategory,
        uniqueAuthorsByTags,
        uniqueSitesByTags,
      }
    }
  
    return result
  }
  
  function getUniqueAuthorsByKeywordChart(queryResults, filter, keyword_name_maps) {
    let keywords = []
    let xAxis = null
    let series = [{ name: 'Number of Authors', data: [] }]
    let total = 0
  
    keywords = filterKeyword(queryResults, filter)
  
    xAxis = {
      categories: keywords.map((arr) => _.last(convertKeywordIdToText(arr, keyword_name_maps).split('_'))),
      categories2: keywords,
    }
  
    series[0].data = keywords.map((keyword) => {
      let total = queryResults.map((data) => {
        let haveKeyword = data._id.keywords.includes(keyword)
        if (haveKeyword) {
          return data.arr_name
        } else {
          return []
        }
      })
  
      return [...new Set([].concat(...total))].length
    })
  
    let result = _.cloneDeep({ xAxis, series, total: total })
    // Check empty data
    if (_.isEmpty(filter.find.keywords)) {
      result = clearEmptyData(result)
    }
  
    return result
  }
  function getUniqueSitesByKeywordChart(queryResults, filter, keyword_name_maps) {
    let keywords = []
    let xAxis = null
    let series = [{ name: 'Number of Sites', data: [] }]
    let total = 0
  
    keywords = filterKeyword(queryResults, filter)
  
    xAxis = {
      categories: keywords.map((arr) => _.last(convertKeywordIdToText(arr, keyword_name_maps).split('_'))),
      categories2: keywords,
    }
  
    series[0].data = keywords.map((keyword) => {
      let total = queryResults.map((data) => {
        let haveKeyword = data._id.keywords.includes(keyword)
        if (haveKeyword) {
          return data.arr_domain
        } else {
          return []
        }
      })
      return [...new Set([].concat(...total))].length
    })
  
    let result = _.cloneDeep({ xAxis, series, total: total })
    // Check empty data
    if (_.isEmpty(filter.find.keywords)) {
      result = clearEmptyData(result)
    }
  
    return result
  }
  function getUniqueAuthorsByChannelChart(queryResults, filter, keyword_name_maps) {
    let channels = []
    let xAxis = null
    let series = [{ name: 'channels', colorByPoint: true, data: [] }]
    let total = 0
  
    if (!_.isEmpty(filter.find.channel)) {
      channels = filter.find.channel.map((arr) => arr.replace('*', ''))
    } else {
      channels = [...new Set(queryResults.map((arr) => arr._id.channel.split('-')[0]))]
    }
  
    xAxis = { type: 'category' }
  
    series[0].data = channels.map((channel) => {
      let total = queryResults.map((data) => {
        let haveChannel = data._id.channel.includes(channel)
        if (haveChannel) {
          return data.arr_name
        } else {
          return []
        }
      })
  
      return { name: channel, y: [...new Set([].concat(...total))].length }
    })
  
    // return { xAxis, series, total: total }
  
    let result = _.cloneDeep({ xAxis, series, total: total })
    // Check empty data
    if (_.isEmpty(filter.find.channel)) {
      result = clearEmptyData(result, 'UniqueAuthorsByChannel')
    } else {
      if (result.series[0].data.every((serie) => serie.y == 0)) {
        result.series[0].data = []
      }
    }
  
    return result
  }
  function getUniqueSitesByChannelChart(queryResults, filter, keyword_name_maps) {
    let channels = []
    let xAxis = null
    let series = [{ name: 'channels', colorByPoint: true, data: [] }]
    let total = 0
  
    if (!_.isEmpty(filter.find.channel)) {
      channels = filter.find.channel.map((arr) => arr.replace('*', ''))
    } else {
      channels = [...new Set(queryResults.map((arr) => arr._id.channel.split('-')[0]))]
    }
  
    xAxis = { type: 'category' }
  
    series[0].data = channels.map((channel) => {
      let total = queryResults.map((data) => {
        let haveChannel = data._id.channel.includes(channel)
        if (haveChannel) {
          return data.arr_domain
        } else {
          return []
        }
      })
  
      return { name: channel, y: [...new Set([].concat(...total))].length }
    })
  
    let result = _.cloneDeep({ xAxis, series, total: total })
    // Check empty data
    if (_.isEmpty(filter.find.channel)) {
      result = clearEmptyData(result, 'UniqueSitesByChannel')
    } else {
      if (result.series[0].data.every((serie) => serie.y == 0)) {
        result.series[0].data = []
      }
    }
  
    return result
  }
  function getUniqueAuthorsBySentimentChart(queryResults, filter, keyword_name_maps) {
    let allSentiment = ['positive', 'neutral', 'negative']
    let sentiments = []
    let keywords = []
    let xAxis = null
    let series = [{ name: 'channels', colorByPoint: true, data: [] }]
    let total = 0
  
    keywords = filterKeyword(queryResults, filter)
  
    if (!_.isEmpty(filter.find.sentiment)) {
      sentiments = filter.find.sentiment
    } else {
      sentiments = [...new Set([].concat(...queryResults.map((arr) => arr._id.keyword_sentiment.map((ks) => _.last(ks.split('§'))))))]
    }
    // allSentiment = allSentiment.filter((arr) => sentiments.includes(arr))
  
    xAxis = { type: 'category' }
  
    series[0].data = allSentiment.map((sentiment) => {
      let total = queryResults.map((data) => {
        let keywordSentiments = data._id.keyword_sentiment.map((arr) => arr.split('§'))
        let haveSentiment = keywordSentiments.filter((arr) => arr[1] == sentiment && keywords.includes(arr[0]))
  
        if (haveSentiment.length > 0) {
          return data.arr_name
        } else {
          return []
        }
      })
  
      return { name: sentiment, y: [...new Set([].concat(...total))].length }
    })
  
    let result = _.cloneDeep({ xAxis, series, total: total })
    // Check empty data
    if (_.isEmpty(filter.find.channel)) {
      result = clearEmptyData(result, 'UniqueAuthorsBySentiment', 'sentiment')
    }
  
    return result
  }
  function getUniqueSitesBySentimentChart(queryResults, filter, keyword_name_maps) {
    let allSentiment = ['positive', 'neutral', 'negative']
    let sentiments = []
    let xAxis = null
    let series = [{ name: 'channels', colorByPoint: true, data: [] }]
    let total = 0
  
    if (!_.isEmpty(filter.find.sentiment)) {
      sentiments = filter.find.sentiment
    } else {
      sentiments = [...new Set([].concat(...queryResults.map((arr) => arr._id.keyword_sentiment.map((ks) => _.last(ks.split('§'))))))]
    }
    // allSentiment = allSentiment.filter((arr) => sentiments.includes(arr))
  
    xAxis = { type: 'category' }
  
    series[0].data = allSentiment.map((sentiment) => {
      let total = queryResults.map((data) => {
        let keywordSentiments = data._id.keyword_sentiment.map((arr) => arr.split('§')[1])
        let haveSentiment = keywordSentiments.filter((arr) => arr == sentiment)
  
        if (haveSentiment.length > 0) {
          return data.arr_domain
        } else {
          return []
        }
      })
  
      return { name: sentiment, y: [...new Set([].concat(...total))].length }
    })
  
    let result = _.cloneDeep({ xAxis, series, total: total })
    // Check empty data
    if (_.isEmpty(filter.find.channel)) {
      result = clearEmptyData(result, 'UniqueSitesBySentiment', 'sentiment')
    }
  
    return result
  }
  function getUniqueAuthorsByCategoryChart(queryResults, filter, tag_name_maps) {
    let categories = []
    let tags = []
    let keywords = []
    let xAxis = null
    let series = [{ name: 'Number of Authors', data: [] }]
    let total = 0
  
    keywords = filterKeyword(queryResults, filter)
    tags = filterTag(queryResults, filter, keywords)
  
    categories = [...new Set(tags.map((tag) => tag.split('_')[0]))]
  
    xAxis = {
      categories2: categories,
      categories: categories.map((arr) => convertTagIdToText(arr, tag_name_maps)),
    }
  
    series[0].data = categories.map((category) => {
      let total = queryResults.map((data) => {
        let keywordcategorys = data._id.keyword_tag.map((arr) => arr.split('§'))
        let havecategory = null
  
        if (keywordcategorys.length < 1) {
          return []
        }
  
        havecategory = keywordcategorys.filter((arr) => {
          let tmp = keywords.filter((keyword) => {
            return arr[0].includes(keyword)
          })
          return arr[1].includes(category) && tmp
        })
  
        if (havecategory.length > 0) {
          return data.arr_name
        } else {
          return []
        }
      })
      return [...new Set([].concat(...total))].length
    })
  
    let result = _.cloneDeep({ xAxis, series, total: total })
    // Check empty data
    if (_.isEmpty(filter.find.channel)) {
      result = clearEmptyData(result, 'UniqueSitesBySentiment')
    }
  
    return result
    // let result = _.cloneDeep({ xAxis, series, total: total })
    // // Check empty data
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
    // return result
  }
  function getUniqueSitesByCategoryChart(queryResults, filter, tag_name_maps) {
    let categories = []
    let tags = []
    let keywords = filter.find.keywords
    let xAxis = null
    let series = [{ name: 'Number of Sites', data: [] }]
    let total = 0
  
    keywords = filterKeyword(queryResults, filter)
    tags = filterTag(queryResults, filter, keywords)
  
    categories = [...new Set(tags.map((tag) => tag.split('_')[0]))]
  
    xAxis = {
      categories2: categories,
      categories: categories.map((arr) => convertTagIdToText(arr, tag_name_maps)),
    }
  
    series[0].data = categories.map((category) => {
      let total = queryResults.map((data) => {
        let keywordcategorys = data._id.keyword_tag.map((arr) => arr.split('§'))
        let havecategory = null
  
        if (keywordcategorys.length < 1) {
          return []
        }
  
        havecategory = keywordcategorys.filter((arr) => {
          let tmp = keywords.filter((keyword) => {
            return arr[0].includes(keyword)
          })
          return arr[1].includes(category) && tmp
        })
  
        if (havecategory.length > 0) {
          return data.arr_domain
        } else {
          return []
        }
      })
      return [...new Set([].concat(...total))].length
    })
  
    let result = _.cloneDeep({ xAxis, series, total: total })
    // Check empty data
    if (_.isEmpty(filter.find.channel)) {
      result = clearEmptyData(result, 'UniqueSitesBySentiment')
    }
  
    return result
    // let result = _.cloneDeep({ xAxis, series, total: total })
    // // Check empty data
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
    // return result
  }
  function getUniqueAuthorsByTagsChart(queryResults, filter, tag_name_maps) {
    let tags = []
    let keywords = []
    let xAxis = null
    let series = [{ name: 'Number of Authors', data: [] }]
    let total = 0
  
    keywords = filterKeyword(queryResults, filter)
    tags = filterTag(queryResults, filter, keywords)
  
    xAxis = {
      categories2: tags,
      categories: tags.map((arr) => _.last(convertTagIdToText(arr, tag_name_maps).split('_'))),
    }
  
    series[0].data = tags.map((tag) => {
      let total = queryResults.map((data) => {
        let keywordTags = data._id.keyword_tag.map((arr) => arr.split('§'))
        let haveTag = null
  
        if (keywordTags.length < 1) {
          return []
        }
  
        haveTag = keywordTags.filter((arr) => {
          let tmp = keywords.filter((keyword) => {
            return arr[0].includes(keyword)
          })
          return arr[1] == tag && tmp
        })
  
        if (haveTag.length > 0) {
          return data.arr_name
        } else {
          return []
        }
      })
      return [...new Set([].concat(...total))].length
    })
  
    let result = _.cloneDeep({ xAxis, series, total: total })
    // Check empty data
    if (_.isEmpty(filter.find.channel)) {
      result = clearEmptyData(result, 'UniqueSitesBySentiment')
    }
  
    return result
  }
  function getUniqueSitesByTagsChart(queryResults, filter, tag_name_maps) {
    let tags = []
    let keywords = []
    let xAxis = null
    let series = [{ name: 'Number of Sites', data: [] }]
    let total = 0
  
    keywords = filterKeyword(queryResults, filter)
    tags = filterTag(queryResults, filter, keywords)
  
    xAxis = {
      categories2: tags,
      categories: tags.map((arr) => _.last(convertTagIdToText(arr, tag_name_maps).split('_'))),
    }
  
    series[0].data = tags.map((tag) => {
      let total = queryResults.map((data) => {
        let keywordTags = data._id.keyword_tag.map((arr) => arr.split('§'))
        let haveTag = null
  
        if (keywordTags.length < 1) {
          return []
        }
  
        haveTag = keywordTags.filter((arr) => {
          let tmp = keywords.filter((keyword) => {
            return arr[0].includes(keyword)
          })
          return arr[1] == tag && tmp
        })
  
        if (haveTag.length > 0) {
          return data.arr_domain
        } else {
          return []
        }
      })
      return [...new Set([].concat(...total))].length
    })
  
    let result = _.cloneDeep({ xAxis, series, total: total })
    // Check empty data
    if (_.isEmpty(filter.find.channel)) {
      result = clearEmptyData(result, 'UniqueSitesBySentiment')
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
  
  function convertKeywordIdToText(keyword, keyword_name_maps) {
    if (keyword_name_maps == null) {
      return keyword
    }
  
    return keyword
      .split('_')
      .map((k) => {
        let theKeyword = keyword_name_maps.find((arr) => arr._id == k)
  
        if (theKeyword == null) {
          return k
        } else {
          return theKeyword.name
        }
      })
      .join('_')
  }
  
  function filterKeyword(queryResults, filter) {
    let keywords = []
  
    if (filter.find.keywords) {
      keywords = filter.find.keywords
      // keywords = [...new Set([].concat(...queryResults.map((data) => data._id.keywords)))].filter((k) => filter.find.keywords.some((kw) => k.includes(kw)))
    } else {
      keywords = [...new Set([].concat(...queryResults.map((data) => data._id.keywords)))]
    }
    keywords.sort()
    keywords = keywords.filter((arr) => arr !== 'Monitor')
  
    return keywords
  }
  
  function filterTag(queryResults, filter, keywords) {
    // Tags
    let tags = []
    if (filter.find.tags) {
      tags = filter.find.tags
    } else {
      let keyword_tags = _.compact([...new Set([].concat(...queryResults.map((data) => data._id.keyword_tag)))])
  
      if (_.isEmpty(keyword_tags)) {
        tags = []
      } else {
        tags = [
          ...new Set(
            keyword_tags
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
    }
    // Exclude Tags
    if (filter.find.ex_tags) {
      let exTags = [...new Set(filter.find.ex_tags)]
      tags = tags.filter((tag) => !exTags.find((exTag) => exTag == tag))
    }
    tags.sort()
  
    return tags
  }
  function clearEmptyData(data, api, type) {
    if (data.series) {
      switch (api) {
        case 'UniqueAuthorsByChannel':
        case 'UniqueSitesByChannel':
        case 'UniqueAuthorsBySentiment':
        case 'UniqueSitesBySentiment':
          if (data.series[0].data.every((serie) => serie.y == 0)) {
            data.series[0].data = []
          }
  
          if (type != 'sentiment') {
            if (data.series[0].data.length > 0) {
              data.series[0].data = data.series[0].data.filter((serie) => serie.y != 0)
            }
          }
          break
  
        default:
          data.series = data.series.filter((serie) => !serie.data.every((s) => s == 0))
          if (data.series.length > 0) {
            data.xAxis.categories = data.xAxis.categories.filter((cat, key) => {
              const isEmpty = data.series.map((item) => item.data[key]).every((item) => item == 0)
              if (isEmpty) {
                data.series = data.series.map((item, skey) => {
                  let tmp = _.cloneDeep(item)
                  delete tmp.data[key]
                  return tmp
                })
                delete data.xAxis.categories2[key]
              }
  
              return !isEmpty
            })
            data.xAxis.categories2 = data.xAxis.categories2.filter((item) => item !== undefined)
            data.series.map((item) => {
              item.data = item.data.filter((item) => item !== undefined)
              return item
            })
          }
          break
      }
    } else {
      if (data.every((arr) => arr.y == 0)) {
        data = []
      }
    }
  
    return data
  }
  

  async function getTopInfluencerPrevious(req) {
    try {
      let startDate = moment(req.startDate)
      let endDate = moment(req.endDate)
      let arrId = req.id_arr
      let find = req.find || {}
      let compareDate = {
        start: moment(startDate).subtract(endDate.diff(startDate, 'day', true), 'day'),
        end: moment(startDate).subtract(1, 'second'),
      }
  
      let firstDate_start = moment(_.cloneDeep(startDate).startOf('month'))
      let lastDate_end = moment(_.cloneDeep(endDate).endOf('month'))
      let temp_find = await fl.filterFormal(find, req.email)
  
      if (firstDate_start.diff(startDate, 'day') == 0 && lastDate_end.diff(endDate, 'day') == 0) {
        let firstDate_compare_start = moment(_.cloneDeep(startDate).subtract('1', 'month')).startOf('month')
        let lastDate_compare_end = moment(_.cloneDeep(endDate).subtract('1', 'month')).endOf('month')
        compareDate.start = firstDate_compare_start
        compareDate.end = lastDate_compare_end
      }
      const filter = {
        ...req,
        find,
        startDate: compareDate.start,
        endDate: compareDate.end,
      }
  
      const { match, hint, advanceSearchFields: advanceSearch } = await filterFormalV2(filter)
      const advanceSearchFields = !_.isEmpty(advanceSearch) ? [advanceSearch] : []
      let aggregatePreviousList = [
        ...advanceSearchFields,
        {
          $match: {
            ...match,
            $or: [
              {
                'content.from.id': { $in: arrId },
              },
              {
                'content.user.id_str': { $in: arrId },
              },
              {
                'content.uid': { $in: arrId },
              },
              {
                'content.pageName': { $in: arrId },
              },
              {
                'content.author_id': { $in: arrId },
              },
            ],
          },
        },
        {
          $project: {
            _id: {
              $ifNull: [
                '$content.from.id',
                {
                  $ifNull: [
                    '$content.user.id_str',
                    {
                      $ifNull: [
                        '$content.uid',
                        {
                          $ifNull: [
                            '$content.pageName',
                            {
                              $ifNull: ['$content.uid', '$content.author_id'],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            channel: '$channel',
            domain: '$domain',
            name: {
              $ifNull: [
                '$content.from.name',
                {
                  $ifNull: [
                    '$content.user.name',
                    {
                      $ifNull: [
                        '$content.user.username',
                        {
                          $ifNull: [
                            '$content.snippet.channelTitle',
                            {
                              $ifNull: ['$content.username', '$content.author'],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            follower: {
              $ifNull: [
                '$follower',
                {
                  $ifNull: [
                    '$content.follower',
                    {
                      $ifNull: [
                        '$content.from.followers_count',
                        {
                          $ifNull: [
                            '$content.user.followers_count',
                            {
                              $ifNull: [
                                '$content.followers',
                                {
                                  $ifNull: ['$content.user.edge_followed_by', 0],
                                },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            engagement: '$totalEngagement',
          },
        },
        {
          $sort: {
            follower: -1,
            engagement: -1,
            post: -1,
          },
        },
        {
          $group: {
            _id: '$_id',
            channel: {
              $first: '$channel',
            },
            name: {
              $first: '$name',
            },
            follower: {
              $first: '$follower',
            },
            post: {
              $sum: 1,
            },
            engagement: {
              $sum: '$engagement',
            },
            domain: {
              $first: '$domain',
            },
          },
        },
      ]
  
      let previousResult = await mongodb.findAggregateOpts('social_messages', 'socialSchema', aggregatePreviousList, { hint })
  
      return { arr_data: previousResult }
    } catch (error) {
      console.log('{getTopInfluencerPrevious error} :', error)
      return error
    }
  }

  async function getTopInfluencer(req) {
    let find = req.find || {}
    let temp_find = await fl.filterFormal(find, req.email)
    let obj_result = []
    const { match, hint, advanceSearchFields: advanceSearch } = await filterFormalV2(req)
    const advanceSearchFields = !_.isEmpty(advanceSearch) ? [advanceSearch] : []
    let arr_aggregate = [
      ...advanceSearchFields,
      {
        $match: match,
      },
      {
        $project: {
          _id: {
            $ifNull: [
              '$content.from.id',
              {
                $ifNull: [
                  '$content.user.id_str',
                  {
                    $ifNull: [
                      '$content.uid',
                      {
                        $ifNull: [
                          '$content.pageName',
                          {
                            $ifNull: ['$content.uid', '$content.author_id'],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          channel: '$channel',
          domain: '$domain',
          name: {
            $ifNull: [
              '$content.from.name',
              {
                $ifNull: [
                  '$content.user.name',
                  {
                    $ifNull: [
                      '$content.user.username',
                      {
                        $ifNull: [
                          '$content.snippet.channelTitle',
                          {
                            $ifNull: ['$content.username', '$content.author'],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          pic_profile: {
            $ifNull: [
              '$content.from.picture',
              {
                $ifNull: [
                  '$content.user.profile_image_url_https',
                  {
                    $ifNull: [
                      '$content.channelImageURL',
                      {
                        $ifNull: [
                          '$content.from.profile_pic',
                          {
                            $ifNull: ['$content.from.profile_pic', '$content.author_img'],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          follower: {
            $ifNull: [
              '$follower',
              {
                $ifNull: [
                  '$content.follower',
                  {
                    $ifNull: [
                      '$content.from.followers_count',
                      {
                        $ifNull: [
                          '$content.user.followers_count',
                          {
                            $ifNull: [
                              '$content.followers',
                              {
                                $ifNull: ['$content.user.edge_followed_by', 0],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          subUrl: {
            $cond: {
              if: { $or: [{ $regexMatch: { input: '$channel', regex: 'website*' } }, { $regexMatch: { input: '$channel', regex: 'webboard*' } }] },
              then: '$domain',
              else: {
                $ifNull: [
                  {
                    $concat: [
                      'https://',
                      {
                        $replaceOne: {
                          input: {
                            $arrayElemAt: [
                              {
                                $split: ['$channel', '-'],
                              },
                              0,
                            ],
                          },
                          find: 'group',
                          replacement: '',
                        },
                      },
                      '.com/',
                      '$content.from.id',
                    ],
                  },
                  {
                    $ifNull: [
                      {
                        $concat: ['https://x.com/', '$content.user.screen_name'],
                      },
                      {
                        $ifNull: [
                          {
                            $concat: [
                              'https://pantip.com/profile/',
                              {
                                $convert: {
                                  input: '$content.uid',
                                  to: 'string',
                                },
                              },
                            ],
                          },
                          {
                            $ifNull: [
                              {
                                $concat: ['https://www.youtube.com/channel/', '$content.snippet.channelId'],
                              },
                              {
                                $ifNull: [
                                  {
                                    $concat: ['https://www.instagram.com/', '$content.author'],
                                  },
                                  {
                                    $ifNull: [
                                      {
                                        $concat: ['https://www.tiktok.com/', '$content.pageName'],
                                      },
                                      '$domain',
                                    ],
                                  },
                                ],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            },
          },
          engagement: '$totalEngagement',
        },
      },
      {
        $match: {
          _id: {
            $ne: '',
          },
        },
      },
      {
        $sort: {
          follower: -1,
          engagement: -1,
          post: -1,
        },
      },
      {
        $group: {
          _id: '$_id',
          channel: {
            $first: '$channel',
          },
          name: {
            $first: '$name',
          },
          pic_profile: {
            $first: '$pic_profile',
          },
          follower: {
            $first: '$follower',
          },
          subUrl: {
            $first: '$subUrl',
          },
          post: {
            $sum: 1,
          },
          engagement: {
            $sum: '$engagement',
          },
          domain: {
            $first: '$domain',
          },
        },
      },
      {
        $match: {
          name: {
            $ne: null,
          },
        },
      },
    ]
    // console.log('arr_aggregate', JSON.stringify(arr_aggregate, null, 2))
    obj_result = await mongodb.findAggregateOpts('social_messages', 'socialSchema', arr_aggregate, { hint })
    obj_result = _(obj_result)
      .groupBy('_id')
      .map((objs, key) => ({
        _id: key,
        channel: objs[0].channel,
        name: objs[0].name,
        pic_profile: objs[0].pic_profile,
        follower: objs[0].follower,
        subUrl: objs[0].subUrl,
        post: _.sumBy(objs, 'post'),
        engagement: _.sumBy(objs, 'engagement'),
        domain: objs[0].domain,
      }))
      .value()
  
    // console.log('obj_result :', JSON.stringify(obj_result))
  
    obj_result = _.orderBy(obj_result, ['engagement', 'follower', 'post'], ['desc', 'desc', 'desc'])
    let arr_data = obj_result
    let hasNull = !_.isEmpty(arr_data.find((o) => o._id == 'null'))
    let uniqueAuthor = arr_data.length
    uniqueAuthor = hasNull ? uniqueAuthor - 1 : uniqueAuthor
    let uniqueSite = (await _.unionBy(arr_data, 'domain')).length
    let mention = await _.sumBy(arr_data, 'post')
    let averageMentionAuthor = _.round(mention / uniqueAuthor, 2)
    let averageMentionSite = _.round(mention / uniqueSite, 2)
    arr_data = arr_data.filter((o) => o._id != 'null').slice(0, 100)
  
    return { arr_data, uniqueAuthor, uniqueSite, averageMentionAuthor, averageMentionSite }
  }