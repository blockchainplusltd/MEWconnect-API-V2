'use strict'

import AWS from 'aws-sdk'
import { validConnId, validHex, validRole } from '@util/validation'
import { stages } from '@util/signals'

const ddb = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10' })
const { TABLE_NAME } = process.env

/**
 * Handle an incoming WebSocket connection and update the dynamoDB database with pertinent information.
 * The handling of a request will be different depending on whether the given query parameter @role
 * is "initiator" or "receiver".
 * The initial connection request must have the following query parameters 
 * or the client will not be able to attempt a connection:
 * 
 * @param  {String} role - initiator or receiver
 * @param  {String} connId - Last 32 characters of the public key portion of the key-pair
 *                           created for the particular paired connection
 * @param  {String} signed - Private key signed with the private key created for the connection
 */
const handler = async (event, context) => {
  let connectionId = event.requestContext.connectionId
  let query = event.queryStringParameters || {}
  let role = query.role || null
  let connId = query.connId || null
  let signed = query.signed || null

  if (!validRole(role)) return { statusCode: 500, body: 'Failed to connect: Invalid @role' }
  if (!validConnId(connId)) return { statusCode: 500, body: 'Failed to connect: Invalid @signed' }
  if (!validHex(signed)) return { statusCode: 500, body: 'Failed to connect: Invalid @signed' }

  const connectionData = {
    connectionId,
    query
  }

  switch(role) {
    case stages.initiator:
      return await handleInitiator(connectionData)
      break
    case stages.receiver:
      return await handleReceiver(connectionData)
      break
  }
}

/**
 * Create a connection entry with key @connId and initiator details. After successful creation of the entry, 
 * connect the initiator client.
 * 
 * @param  {Object} connectionData - Initial connection/handshake data provided by the initiator
 * @param  {String} connectionData.connectionId - The original connectionId provided/generated by AWS
 * @param  {String} connectionData.query - The handshake/query params provided by the initiator
 * @param  {String} connectionData.query.connId - The client-supplied connection string generated and supplied by the initiator.
 * @param  {String} connectionData.query.signed - The private key signed with the private key generated and supplied by the initiator.
 */
const handleInitiator = async (connectionData) => {
  const putParams = {
    TableName: TABLE_NAME,
    Item: {
      connId: connectionData.query.connId,
      initiator: {
        connectionId: connectionData.connectionId,
        signed: connectionData.query.signed
      }
    }
  }

  try {
    await ddb.put(putParams).promise()
    return { statusCode: 200, body: `Connected` }
  } catch (e) {
    return { statusCode: 500, body: `Failed to connect: ${JSON.stringify(e)}` }
  }
}

/**
 * Search for a matching @connId entry that should have been previously provided/created
 * by the initiator. Ensure that the @signed provided by the initiator and receiver match,
 * so that they can be securely paired. If so, update the connection entry and connect the
 * receiver client.
 * 
 * @param  {Object} connectionData - Initial connection/handshake data provided by the receiver
 * @param  {String} connectionData.connectionId - The original connectionId provided/generated by AWS
 * @param  {String} connectionData.query - The handshake/query params provided by the receiver
 * @param  {String} connectionData.query.connId - The client-supplied connection string originally generated and supplied
 *                                                by the initiator.
 * @param  {String} connectionData.query.signed - The private key signed with the private key originally generated and supplied
 *                                                by the initiator.
 */
const handleReceiver = async (connectionData) => {
  let initiator

  // Query for given @connId //
  const queryParams = {
    TableName: TABLE_NAME,
    Key: {
      connId: connectionData.query.connId
    }
  }

  // Perform query //
  try {
    let entry = await ddb.get(queryParams).promise()
    initiator = entry.Item.initiator
  } catch (e) {
    return { statusCode: 500, body: `Failed to connect: Connection pair doesn't exist!` }
  }
  
  // Check to ensure that given @signed matches what was originally provided by the initiator //
  if (connectionData.query.signed !== initiator.signed) return { statusCode: 500, body: 'Failed to connect: Invalid @signed' }

  // Update entry with receiver information //
  const putParams = {
    TableName: TABLE_NAME,
    Item: {
      connId: connectionData.query.connId,
      initiator: initiator,
      receiver: {
        connectionId: connectionData.connectionId,
        signed: connectionData.query.signed
      }
    }
  }

  // Perform update //
  try {
    await ddb.put(putParams).promise()
    return { statusCode: 200, body: `Connected` }
  } catch (e) {
    return { statusCode: 500, body: `Failed to connect: ${JSON.stringify(e)}` }
  }
}



export { handler }