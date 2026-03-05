async function getTrend(req, res) {
    let data = req.body
    let result = null
    result = await getChartData(data)
    res.json(result)
  }
  async function getChartData(data) {
    let result = null
    let filter = {
      startDate: moment(data.startDate),
      endDate: moment(data.endDate),
      find: data.find || {},
      email: data.email,
      metric: data.metric,
      email: data.email,
    }
    let chartName = data.chartName
  
    if (chartName) {
      try {
        switch (chartName) {
          case 'hostagetop100':
            result = await getTop100hasgtagsChart(filter)
            break
          case 'top100Words':
            result = await getTop100WordsChart(filter)
            break
          case 'shareSpeakerType':
            result = await getShareOfSpeakerTypeChart(filter)
            break
          case 'gender':
            result = await getGenderDemography(filter)
            break
          case 'shareIntent':
            result = await getShareOfIntentChart(filter)
            break
          case 'genderAge':
            const genderResult = await getGenderDemography(filter)
            const genderAgeResult = await getGenderAge(filter)
            result = { gender: genderResult, genderAge: genderAgeResult } // Combine the results
            break
        }
      } catch (e) {
        console.log('[ERROR] getSentiment - ', e.message)
      }
    } else {
      let [shareOfSpeakerType, shareOfIntent, top100hasgtags, topWords, gender, genderAge] = await Promise.all([
        getShareOfSpeakerTypeChart(filter),
        getShareOfIntentChart(filter),
        getTop100hasgtagsChart(filter),
        getTop100WordsChart(filter),
        getGenderDemography(filter),
        getGenderAge(filter),
      ])
  
      result = {
        shareOfSpeakerType,
        shareOfIntent,
        top100hasgtags,
        topWords,
        gender,
        genderAge,
      }
    }
  
    return result
  }
  
  async function getShareOfSpeakerTypeChart(filter) {
    let result = await getData(filter, 'speakerType')
    // if (result.y_axis[0].data.every((arr) => arr == 0) && result.y_axis[1].data.every((arr) => arr == 0)) {
    //   result.y_axis = null
    // }
    return result
  }
  async function getShareOfIntentChart(filter) {
    let result = await getData(filter, 'intent')
    // if (result.y_axis[0].data.every((arr) => arr == 0) && result.y_axis[1].data.every((arr) => arr == 0)) {
    //   result.y_axis = null
    // }
    return result
  }
  async function getData(filter, type) {
    const _filter = _.cloneDeep(filter) || {}
    let find = _.cloneDeep(filter.find) || {}
  
    if (!find[type]) {
      let json = await mongodb.findOne('socialSettingTemplates', 'templateSchema')
      find[type] = json[type].options.map((e) => e.key)
      _filter.find[type] = find[type]
    }
  
    let execute = engagement(_filter.metric)
    const { match, hint, advanceSearchFields: advanceSearch } = await filterFormalV2(_filter)
    const advanceSearchFields = !_.isEmpty(advanceSearch) ? [advanceSearch] : []
    let arr_aggregate = [
      ...advanceSearchFields,
      {
        $match: match,
      },
      ...execute,
      {
        $group: {
          _id: `$${type}`,
          totalEngagement: { $sum: '$totalEngagement' },
          mention: { $sum: 1 },
          engagementView: {
            $sum: {
              $add: [{ $ifNull: ['$totalEngagement', 0] }, { $ifNull: ['$totalView', 0] }],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]
    // console.log(`{getData} :arr_aggregate >> ${type}:`, JSON.stringify(arr_aggregate))
  
    const response = await mongodb.findAggregateOpts('social_messages', 'socialSchema', arr_aggregate, { hint })
    const data = _.cloneDeep(response).map((e) => ({ ...e, _id: e._id || 'none' }))
  
    find[type].forEach(function (value, i) {
      let found = data.some((el) => (el._id === '' ? 'none' : el._id) === value)
      if (!found) data.splice(i, 0, { _id: value, totalEngagement: 0, mention: 0, engagementView: 0 })
    })
    let arr_mention = data.map((e) => e.mention)
    let arr_engagement = data.map((e) => e.totalEngagement)
    let arr_engagement_view = data.map((e) => e.engagementView)
    let arr_name = data.map((e) => e._id)
    let result = {
      y_axis: [{ name: 'mention', type: 'column', data: arr_mention }],
      x_axis: arr_name,
    }
  
    if (filter.metric == 'mention' || filter.metric == 'engagement') {
      result.y_axis.push({ name: 'engagement', type: 'spline', data: arr_engagement })
    } else if (filter.metric == 'engagement_views') {
      result.y_axis.push({ name: 'engagement views', type: 'spline', data: arr_engagement_view })
    }
  
    return result
  }
  
  async function getTop100WordsChart(filter) {
    let result = await getTop100Words(filter)
    result = result.filter((item) => item.name != '#')
    return result
  }
  
  async function getTop100hasgtagsChart(filter) {
    let result = await getTop100hasgtags(filter)
    result = result.filter((item) => item.name != '#')
    return result
  }
  
  async function getTop100Words(req) {
    let find = req.find || {}
    let temp_find = await fl.filterFormal(find, req.email)
    let metric = req.metric || 'mention'
  
    let metricExpression = {
      mention: { $sum: '$content.wordcloud.word.count' },
      engagement: { $sum: { $ifNull: ['$totalEngagement', 0] } },
      engagement_views: {
        $sum: {
          $add: [{ $ifNull: ['$totalEngagement', 0] }, { $ifNull: ['$totalView', 0] }],
        },
      },
    }
  
    const { match, hint, advanceSearchFields: advanceSearch } = await filterFormalV2(req)
    const advanceSearchFields = !_.isEmpty(advanceSearch) ? [advanceSearch] : []
    let arr_aggregate = [
      ...advanceSearchFields,
      {
        $match: match,
      },
      { $unwind: '$content.wordcloud.word' },
      {
        $group: {
          _id: '$content.wordcloud.word.word',
          count: metricExpression[metric],
          countMessages: {
            $count: {},
          },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 100 },
      { $project: { _id: 0, name: '$_id', value: '$count', countMessages: '$countMessages' } },
    ]
  
    let obj_result = await mongodb.findAggregateOpts('social_messages', 'socialSchema', arr_aggregate, { hint })
  
    return obj_result
  }
  async function getTop100hasgtags(req) {
    let find = req.find || {}
    let temp_find = await fl.filterFormal(find, req.email)
    let metric = req.metric || 'mention'
  
    let metricExpression = {
      mention: { $sum: '$content.wordcloud.hashtag.count' },
      engagement: { $sum: { $ifNull: ['$totalEngagement', 0] } },
      engagement_views: {
        $sum: {
          $add: [{ $ifNull: ['$totalEngagement', 0] }, { $ifNull: ['$totalView', 0] }],
        },
      },
    }
    const { match, hint, advanceSearchFields: advanceSearch } = await filterFormalV2(req)
    const advanceSearchFields = !_.isEmpty(advanceSearch) ? [advanceSearch] : []
    let arr_aggregate = [
      ...advanceSearchFields,
      {
        $match: match,
      },
      { $unwind: '$content.wordcloud.hashtag' },
      {
        $group: {
          _id: '$content.wordcloud.hashtag.word',
          count: metricExpression[metric],
          countMessages: {
            $count: {},
          },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 100 },
      { $project: { _id: 0, name: '$_id', value: '$count', countMessages: '$countMessages' } },
    ]
  
    // console.log('arr_aggregate :', JSON.stringify(arr_aggregate))
  
    let obj_result = await mongodb.findAggregateOpts('social_messages', 'socialSchema', arr_aggregate, { hint })
  
    return obj_result
  }
  
  async function getGenderDemography(filter) {
    let find = filter.find || {}
    let temp_find = await fl.filterFormal(find, filter.email)
  
    let metricExpression = {
      mention: { $sum: 1 },
      engagement: { $sum: { $ifNull: ['$totalEngagement', 0] } },
      engagement_views: {
        $sum: {
          $add: [{ $ifNull: ['$totalEngagement', 0] }, { $ifNull: ['$totalView', 0] }],
        },
      },
    }
    const { match, hint, advanceSearchFields: advanceSearch } = await filterFormalV2(filter)
    const advanceSearchFields = !_.isEmpty(advanceSearch) ? [advanceSearch] : []
    let arr_aggregate = [
      ...advanceSearchFields,
      {
        $match: match,
      },
      { $group: { _id: '$content.gender', count: metricExpression[filter.metric] } },
      { $sort: { count: -1 } },
      { $project: { _id: 0, gender: '$_id', value: '$count' } },
    ]
  
    // console.log('{arr_aggregate getGenderDemography} :', JSON.stringify(arr_aggregate))
  
    let obj_result = await mongodb.findAggregateOpts('social_messages', 'socialSchema', arr_aggregate, { hint })
  
    let result = {}
    let sumValue = 0
    let data = []
    let male = obj_result.filter(function (i) {
      return i.gender == 'male'
    })
    if (male.length) {
      sumValue += male[0].value
      data.push(male[0])
    } else {
      data.push({ gender: 'male', value: 0 })
    }
  
    let female = obj_result.filter(function (i) {
      return i.gender == 'female'
    })
  
    if (female.length) {
      sumValue += female[0].value
      data.push(female[0])
    } else {
      data.push({ gender: 'female', value: 0 })
    }
  
    let unknown = obj_result.filter(function (i) {
      return i.gender == 'unknown'
    })
  
    if (unknown.length) {
      sumValue += unknown[0].value
      data.push(unknown[0])
    } else {
      data.push({ gender: 'unknown', value: 0 })
    }
  
    result.data = data
  
    if (sumValue == 0) {
      result.percent_male = 0
      result.percent_female = 0
      result.percent_unknown = 0
    } else {
      for (const i of data) {
        // result[`percent_${i.gender}`] = Math.round((i.value / sumValue) * 100)
        result[`percent_${i.gender}`] = numeral((i.value / sumValue) * 100).format('0.00')
      }
    }
    return result
  }
  
  async function getGenderAge(filter) {
    try {
      let find = filter.find || {}
      let temp_find = await fl.filterFormal(find, filter.email)
      let metric = filter.metric || 'mention'
  
      let metricExpression = {
        mention: 1,
        engagement: { $ifNull: ['$totalEngagement', 0] },
        engagement_views: { $add: [{ $ifNull: ['$totalEngagement', 0] }, { $ifNull: ['$totalView', 0] }] },
      }
  
      const { match, hint, advanceSearchFields: advanceSearch } = await filterFormalV2(filter)
      const advanceSearchFields = !_.isEmpty(advanceSearch) ? [advanceSearch] : []
      let arr_aggregate = [
        ...advanceSearchFields,
        {
          $match: match,
        },
        {
          $bucket: {
            groupBy: '$content.age',
            boundaries: [11, 21, 31, 41, 51, 61, 100],
            default: 'unknown',
            output: {
              maleValue: {
                $sum: { $cond: [{ $eq: ['$content.gender', 'male'] }, metricExpression[metric], 0] },
              },
              femaleValue: {
                $sum: { $cond: [{ $eq: ['$content.gender', 'female'] }, metricExpression[metric], 0] },
              },
              unknownValue: {
                $sum: { $cond: [{ $eq: ['$content.gender', 'unknown'] }, metricExpression[metric], 0] },
              },
            },
          },
        },
        {
          $addFields: {
            ageRange: {
              $switch: {
                branches: [
                  { case: { $eq: ['$_id', 11] }, then: '11-20' },
                  { case: { $eq: ['$_id', 21] }, then: '21-30' },
                  { case: { $eq: ['$_id', 31] }, then: '31-40' },
                  { case: { $eq: ['$_id', 41] }, then: '41-50' },
                  { case: { $eq: ['$_id', 51] }, then: '51-60' },
                  { case: { $eq: ['$_id', 61] }, then: '> 60' },
                  { case: { $eq: ['$_id', 'unknown'] }, then: 'unknown' },
                ],
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            ageRange: 1,
            male: '$maleValue',
            female: '$femaleValue',
            unknown: '$unknownValue',
          },
        },
      ]
  
      let obj_result = await mongodb.findAggregateOpts('social_messages', 'socialSchema', arr_aggregate, { hint })
  
      let xAxis = { categories: ['11-20', '21-30', '31-40', '41-50', '51-60', '> 60', 'unknown'] }
      let series = [
        { name: 'male', data: Array(xAxis.categories.length).fill(0) },
        { name: 'female', data: Array(xAxis.categories.length).fill(0) },
        { name: 'unknown', data: Array(xAxis.categories.length).fill(0) },
      ]
  
      obj_result.forEach((el) => {
        const categoryIndex = xAxis.categories.indexOf(el.ageRange)
        if (categoryIndex !== -1) {
          series[0].data[categoryIndex] = el.male
          series[1].data[categoryIndex] = el.female
          series[2].data[categoryIndex] = el.unknown
        }
      })
  
      const validIndices = xAxis.categories.map((_, index) => (series.some((s) => s.data[index] > 0) ? index : -1)).filter((index) => index !== -1)
  
      return {
        xAxis: { categories: validIndices.map((i) => xAxis.categories[i]) },
        series: series.map((s) => ({
          name: s.name,
          data: validIndices.map((i) => s.data[i]),
        })),
      }
    } catch (error) {
      console.log('getGenderAge error :', error)
      throw error
    }
  }
  