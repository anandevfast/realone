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