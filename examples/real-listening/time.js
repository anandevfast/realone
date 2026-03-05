
async function getTime(req, res) {
    let data = req.body
    data.keyword_name_maps = req.app.get('keyword_name_maps')
    data.tag_name_maps = req.app.get('tag_name_maps')
    let result = null
    result = await getChartData(data)
    res.json(result)
  }
  async function getChartData(data) {
    const keyword_name_maps = data.keyword_name_maps
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
    let execute = engagement(data.metric)
    let filter = {
      find: data.find || {},
      metric: data.metric || {},
      startDate: data.startDate || {},
      endDate: data.endDate || {},
      email: data.email,
    }
    let chartName = data.chartName
    // let dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    // let hour = ['00', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23']
  
    const { match, hint, advanceSearchFields: advanceSearch } = await filterFormalV2(filter)
    const advanceSearchFields = !_.isEmpty(advanceSearch) ? [advanceSearch] : []
    let arr_aggregate = [
      { $unwind: '$keywords' },
      ...advanceSearchFields,
      {
        $match: match,
      },
      ...execute,
      {
        $group: {
          _id: {
            hour: '$hour',
            date: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: { $toDate: '$publishedAtUnix' },
                timezone: '+07:00',
              },
            },
            // date: { $substr: ['$publisheddate', 0, 10] },
            keywords: '$keywords',
          },
          count: { $sum: '$engagement' },
        },
      },
    ]
    // console.log('arr_aggregate time:', JSON.stringify(arr_aggregate))
    let obj_result = await mongodb.findAggregateOpts('social_messages', 'socialSchema', arr_aggregate, { hint })
  
    if (chartName) {
      try {
        switch (chartName) {
          case 'volumeBytime':
            result = await getVolumeByTimeChart(obj_result, filter)
            break
          case 'volumeByday':
            result = await getVolumeByDayChart(obj_result, filter)
            break
          case 'volumeByday&time':
            result = await getVolumeByDayAndTimeChart(obj_result, filter, keyword_name_maps)
            break
          case 'heatmapBytime':
            result = await getHeatmapByTimeChart(obj_result, filter, keyword_name_maps)
            break
          case 'heatmapByday':
            result = await getHeatmapByDayChart(obj_result, filter, keyword_name_maps)
            break
        }
      } catch (e) {
        console.log('[ERROR] getSentiment - ', e.message)
      }
    } else {
      let [volumeBytime, volumeByday, heatmapByday, heatmapBytime, volumeByDayAndTime] = await Promise.all([
        getVolumeByTimeChart(obj_result, filter),
        getVolumeByDayChart(obj_result, filter),
        getHeatmapByDayChart(obj_result, filter, keyword_name_maps),
        getHeatmapByTimeChart(obj_result, filter, keyword_name_maps),
        getVolumeByDayAndTimeChart(obj_result, filter, keyword_name_maps),
      ])
  
      result = { volumeBytime, volumeByday, heatmapByday, heatmapBytime, volumeByDayAndTime }
    }
  
    return result
  }
  
  async function getVolumeByTimeChart(obj_result, filter) {
    let hour = ['00', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23']
    let filterHours = []
    let keywords = []
  
    filterHours = filterHour(filter)
    keywords = filterKeyword(obj_result, filter)
  
    let data = {
      series: [
        {
          name: 'volumeBytime',
          data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        },
      ],
      xAxis: {
        categories: [],
      },
    }
    for (let h of obj_result) {
      if (!filterHours.find((arr) => +arr == h._id.hour)) {
        continue
      }
  
      if (!keywords.find((arr) => arr == h._id.keywords)) {
        continue
      }
      // if (!keywords.find((arr) => arr.includes(h._id.keywords))) {
      //   continue
      // }
  
      data.series[0].data[h._id.hour] += h.count
    }
    data.xAxis.categories = hour
  
    data.series = data.series.filter((serie) => !serie.data.every((d) => d == 0))
    return data
  }
  async function getVolumeByDayChart(obj_result, filter) {
    let dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    let filterHours = []
    let keywords = []
  
    filterHours = filterHour(filter)
    keywords = filterKeyword(obj_result, filter)
  
    let data = {
      series: [
        {
          name: 'volumeByday',
          data: [0, 0, 0, 0, 0, 0, 0],
        },
      ],
      xAxis: {
        categories: [],
      },
    }
    for (let d of obj_result) {
      if (!filterHours.find((arr) => +arr == d._id.hour)) {
        continue
      }
  
      if (!keywords.find((arr) => arr == d._id.keywords)) {
        continue
      }
  
      let day = moment(d._id.date).isoWeekday()
  
      if (day == 7) {
        day = 0
      }
  
      data.series[0].data[day] += d.count
    }
    data.xAxis.categories = dayOfWeek
  
    data.series = data.series.filter((serie) => !serie.data.every((d) => d == 0))
  
    return data
  }
  async function getHeatmapByDayChart(obj_result, filter, keyword_name_maps) {
    let dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    let filterHours = []
    let keywords = []
  
    filterHours = filterHour(filter)
    keywords = filterKeyword(obj_result, filter)
  
    let data = {
      series: keywords.map((i, j) => {
        return {
          name: keyword_name_maps.find((k) => k._id == _.last(i.split('_'))).name,
          fullLabel: i,
          data: [
            [0, j, 0],
            [1, j, 0],
            [2, j, 0],
            [3, j, 0],
            [4, j, 0],
            [5, j, 0],
            [6, j, 0],
          ],
        }
      }),
      xAxis: {
        categories: dayOfWeek,
      },
      yAxis: {
        categories: keywords.map((i) => keyword_name_maps.find((k) => k._id == _.last(i.split('_'))).name),
      },
    }
  
    for (let d of obj_result) {
      if (!filterHours.find((arr) => +arr == d._id.hour)) {
        continue
      }
  
      if (!keywords.find((arr) => arr == d._id.keywords)) {
        continue
      }
  
      let day = moment(d._id.date).isoWeekday()
  
      if (day == 7) {
        day = 0
      }
  
      let indexDataSeries = data.series[keywords.indexOf(d._id.keywords)].data.findIndex((arr) => arr[0] == day)
  
      if (indexDataSeries < 0) {
        continue
      }
  
      data.series[keywords.indexOf(d._id.keywords)].data[indexDataSeries][2] += d.count
    }
  
    data = _.cloneDeep(data)
    data.series = data.series.filter((serie, key) => {
      const isEmpty = serie.data.every((d) => d[2] == 0)
  
      if (isEmpty) {
        delete data.yAxis.categories[key]
      }
  
      return !isEmpty
    })
    data.series = data.series.filter((serie, key) => {
      serie.data = serie.data.map((d) => {
        d[1] = key
        return d
      })
  
      return serie
    })
    data.yAxis.categories = data.yAxis.categories.filter((item) => item !== undefined)
  
    return data
  }
  async function getHeatmapByTimeChart(obj_result, filter, keyword_name_maps) {
    let hour = ['00', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23']
    let filterHours = []
    let keywords = []
  
    filterHours = filterHour(filter)
    keywords = filterKeyword(obj_result, filter)
  
    let data = {
      series: keywords.map((i, j) => {
        return {
          name: keyword_name_maps.find((k) => k._id == _.last(i.split('_'))).name,
          fullLabel: i,
          data: [
            [0, j, 0],
            [1, j, 0],
            [2, j, 0],
            [3, j, 0],
            [4, j, 0],
            [5, j, 0],
            [6, j, 0],
            [7, j, 0],
            [8, j, 0],
            [9, j, 0],
            [10, j, 0],
            [11, j, 0],
            [12, j, 0],
            [13, j, 0],
            [14, j, 0],
            [15, j, 0],
            [16, j, 0],
            [17, j, 0],
            [18, j, 0],
            [19, j, 0],
            [20, j, 0],
            [21, j, 0],
            [22, j, 0],
            [23, j, 0],
          ],
        }
      }),
      xAxis: {
        categories: hour,
      },
      yAxis: {
        categories: keywords.map((i) => keyword_name_maps.find((k) => k._id == _.last(i.split('_'))).name),
      },
    }
  
    for (let d of obj_result) {
      if (!filterHours.find((arr) => +arr == d._id.hour)) {
        continue
      }
  
      const x = d._id.hour
      const y = keywords.indexOf(d._id.keywords)
      let index = null
  
      if (y < 0) {
        continue
      }
  
      index = data.series[y].data.findIndex((item) => item[0] == x && item[1] == y)
  
      if (index < 0) {
        continue
      }
  
      data.series[keywords.indexOf(d._id.keywords)].data[index][2] += d.count
    }
  
    data = _.cloneDeep(data)
    data.series = data.series.filter((serie, key) => {
      const isEmpty = serie.data.every((d) => d[2] == 0)
  
      if (isEmpty) {
        delete data.yAxis.categories[key]
      }
  
      return !isEmpty
    })
    data.series = data.series.filter((serie, key) => {
      serie.data = serie.data.map((d) => {
        d[1] = key
        return d
      })
  
      return serie
    })
    data.yAxis.categories = data.yAxis.categories.filter((item) => item !== undefined)
  
    return data
  }
  async function getVolumeByDayAndTimeChart(obj_result, filter, keyword_name_maps) {
    let hours = ['00', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23']
    let filterHours = []
    let keywords = []
  
    filterHours = filterHour(filter)
    keywords = filterKeyword(obj_result, filter)
  
    let data = {
      series: [
        {
          name: 'volumeByday&time',
          data: [],
        },
      ],
      xAxis: {
        categories: [
          '00',
          '01',
          '02',
          '03',
          '04',
          '05',
          '06',
          '07',
          '08',
          '09',
          '10',
          '11',
          '12',
          '13',
          '14',
          '15',
          '16',
          '17',
          '18',
          '19',
          '20',
          '21',
          '22',
          '23',
        ],
      },
      yAxis: {
        categories: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      },
    }
  
    obj_result.map((d) => {
      let day = moment(d._id.date).isoWeekday()
      let count = d.count || 0
  
      if (!filterHours.find((arr) => +arr == d._id.hour)) {
        return
      }
  
      if (!keywords.find((arr) => arr == d._id.keywords)) {
        return
      }
  
      if (day == 7) {
        day = 0
      }
  
      hours.map((hour) => {
        if (hour != d._id.hour) {
          return
        }
  
        let indexDataSeries = data.series[0].data.findIndex((arr) => arr[0] == hour && arr[1] == day)
        if (indexDataSeries < 0) {
          data.series[0].data.push([+hour, +day, count])
        } else {
          data.series[0].data[indexDataSeries][2] += count
        }
      })
    })
  
    data.series = data.series.filter((serie) => !serie.data.every((d) => d[2] == 0))
  
    return data
  }
  

  function filterKeyword(obj_result, filter) {
    let keywords = []
    if (!_.isEmpty(filter.find.keywords) && filter.find.keywords.length) {
      keywords = filter.find.keywords
    } else {
      keywords = _.unionBy(obj_result, '_id.keywords').map((o) => o._id.keywords)
    }
    keywords.sort()
    keywords = keywords.filter((arr) => arr !== 'Monitor')
  
    return keywords
  }
  
  function filterHour(filter) {
    let start = moment(filter.startDate).format('HH')
    let end = moment(filter.endDate).format('HH')
    let result = []
  
    if (start == 12) {
      start = 0
    }
  
    for (let index = start; index <= end; index++) {
      result.push(String(index).padStart(2, '0'))
    }
    return result
  }
  