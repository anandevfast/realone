async function getList(req, res, next) {
    try {
      let body = req.body
      let keyword_tag_name_maps = req.app.get('keyword_tag_name_maps')
      res.json(await getListBody(body, keyword_tag_name_maps))
    } catch (error) {
      next(error)
    }
  }
  
  async function getListBody(body, keyword_tag_name_maps, dateType) {
    let page = parseInt(body.page)
    let pagePer = parseInt(body.pagePer)
    let find = body.find || {}
    if (body?.product) find.product = body.product
    if (body?.viewanalytic) find.viewanalytic = body.viewanalytic
    if (typeof find === 'string') find = JSON.parse(find)
    find = await fl.filterFormal(find, body.email)
    let skip = (page - 1) * pagePer
    const filter = await filterFormalV2(body, true)
  
    let match = { ...filter.match }
  
    if (!_.isEmpty(dateType) && dateType !== 'publishedAtUnix') {
      if (match.publishedAtUnix) {
        const { $gte, $lte } = match.publishedAtUnix
  
        match[dateType] = {
          $gte: moment($gte).format('YYYY-MM-DDTHH:mm:ss.0000'),
          $lte: moment($lte).format('YYYY-MM-DDTHH:mm:ss.9999'),
        }
  
        match.publishedAtUnix = {
          $gte: moment().subtract(2, 'days').toDate(),
        }
  
        filter.match = match
      }
    }
  
    return await getMessageData(skip, pagePer, find, keyword_tag_name_maps, filter)
  }
  
  async function getMessageData(skip, pagePer, find = {}, keyword_tag_name_maps, filter) {
    const advanceSearchFields = !_.isEmpty(filter.advanceSearchFields) ? [filter.advanceSearchFields] : []
    let arr_aggregate = [
      ...advanceSearchFields,
      {
        $match: filter.match,
      },
      { $sort: !_.isEmpty(filter.sort) ? filter.sort : { publishedAtUnix: -1 } },
      { $skip: skip },
      { $limit: pagePer },
      { $project: global.projectSocialMessage },
    ]
  
    // console.log(`{getMessageData} :arr_aggregate:`, JSON.stringify(arr_aggregate))
  
    let obj = { messages: await mongodb.findAggregateOpts('social_messages', 'socialSchema', arr_aggregate, { hint: filter.hint }) }
  
    for (let i of obj.messages) {
      await convertIdtoLabelContentKeyword(i, keyword_tag_name_maps)
  
      if (i.channel.includes('facebookgroup')) {
        if (i.content?.from?.name) i.content.from.name = 'ไม่ระบุตัวตน'
        if (i.center_data?.profile?.name) i.center_data.profile.name = 'ไม่ระบุตัวตน'
      }
    }
    return { data: obj.messages, relate_content: [], totalCount: 50000, lastPage: 100 }
    // return { data: obj.messages, totalCount: totalCount, lastPage: Math.ceil(totalCount / pagePer) }
  }
  
  async function getTotalCount(req, res, next) {
    try {
      let body = req.body
      return res.send(await processTotalCount(body))
    } catch (error) {
      next(error)
    }
  }
  
  async function processTotalCount(body, dateType) {
    let find = body.find || {}
    if (body?.product) find.product = body.product
    if (body?.viewanalytic) find.viewanalytic = body.viewanalytic
    if (typeof find === 'string') find = JSON.parse(find)
    find = await fl.filterFormal(find, body.email)
    const timestamp = moment()
    let total_count = 0
    const { match, hint, advanceSearchFields: advanceSearch } = await filterFormalV2(body)
    const advanceSearchFields = !_.isEmpty(advanceSearch) ? [advanceSearch] : []
  
    if (!_.isEmpty(dateType) && dateType !== 'publishedAtUnix') {
      if (match.publishedAtUnix) {
        const { $gte, $lte } = match.publishedAtUnix
  
        match[dateType] = {
          $gte: moment($gte).format('YYYY-MM-DDTHH:mm:ss.0000'),
          $lte: moment($lte).format('YYYY-MM-DDTHH:mm:ss.9999'),
        }
  
        match.publishedAtUnix = {
          $gte: moment().subtract(2, 'days').toDate(),
        }
      }
    }
  
    const pipeline = [...advanceSearchFields, { $match: match }, { $count: 'count' }]
    const data = await mongodb.findAggregateOpts('social_messages', 'socialSchema', pipeline, { hint })
    total_count = !_.isEmpty(data) ? data[0]?.count : 0
    if (total_count > 0) {
      await getQuickQuery(body.email, body.template_id, body, 'message_count', total_count)
    }
  
    if (global.checkIsLocal) console.log(`{getTotalCount} usage time`, moment().diff(timestamp, 'millisecond'), '(ms)')
  
    return { total_count, timeQuery: body.timeQuery }
  }