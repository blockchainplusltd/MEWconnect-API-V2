'use strict'

import AWS from 'aws-sdk'
import '@util/aws/clients/apigatewaymanagementapi'
import { validateSignal, validConnId, validHex, validRole } from '@util/validation'
import { signals } from '@util/signals'

const ddb = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10' })

exports.handler = async (event, context) => {
  let query = event.queryStringParameters || {}
  let role = query.role || null
  let connId = query.connId || null
  let signed = query.signed || null

  if (!validRole(role)) return { statusCode: 500, body: 'Failed to connect: Invalid @role' }
  if (!validConnId(connId)) return { statusCode: 500, body: 'Failed to connect: Invalid @signed' }
  if (!validHex(signed)) return { statusCode: 500, body: 'Failed to connect: Invalid @signed' }

  const putParams = {
    TableName: process.env.TABLE_NAME,
    Item: {
      connectionId: event.requestContext.connectionId,
      connId: connId,
      role: role,
      signed: signed
    }
  }

  try {
    let result = await ddb.put(putParams).promise()
    return { statusCode: 200, body: `Connected` }
  } catch (e) {
    return { statusCode: 500, body: `Failed to connect: ${JSON.stringify(e)}` }
  }
}
