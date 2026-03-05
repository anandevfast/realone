

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