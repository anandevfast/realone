let editMessage = async (req, res) => {
  let { id, set } = req.body
  // let date = moment(req.body.date).format('YYYY-MM-DD')
  // let collection = 'social_' + date
  let update = await mongodb.updateOne('social_messages', 'socialSchema', { _id: mongoose.Types.ObjectId(id) }, { $set: set })
  let result = {
    id: id,
    status: 'error',
  }
  if (update.ok) {
    result = await mongodb.findOne('social_messages', 'socialSchema', { _id: mongoose.Types.ObjectId(id) })
  } else {
    console.log('id', id)
    console.log('set', set)
    console.log('update', update)
  }
  res.send(result)
}

