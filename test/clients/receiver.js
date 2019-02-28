'use strict'

// Imports //


// Lib //
import CryptoUtils from '@utils/crypto-utils'
import WebsocketConnection from '@utils/websocket-connection'
import WebRTCConnection from '@utils/webrtc-connection'
import { stunServers, version, websocketURL, webRTCOptions } from '@config'
import { signals, rtcSignals, roles } from '@signals'

export default class Receiver {

  constructor (options = {}) {
    this.options = options

    this.socket = new WebsocketConnection()
    this.peer = new WebRTCConnection()

    this.publicKey
    this.privateKey
    this.signed
    this.connId

    this.webRTCAnswer
  }

  /*
  ===================================================================================
    Keys
  ===================================================================================
  */
 
  async setKeys (publicKey, privateKey, connId) {
    this.publicKey = publicKey
    this.privateKey = privateKey
    this.connId = connId
    this.signed = CryptoUtils.signMessage(this.privateKey, this.privateKey)
  }

  /*
  ===================================================================================
    Encryption
  ===================================================================================
  */
  
  async encrypt (message) {
    message = typeof message === 'String' ? message : JSON.stringify(message)
    return await CryptoUtils.encrypt(message, this.privateKey)
  }
 
  async decrypt (message) {
    return await CryptoUtils.decrypt(message, this.privateKey)
  }

  /*
  ===================================================================================
    Websocket
  ===================================================================================
  */

  async connect (websocketURL) {
    await this.socket.connect(
      websocketURL, 
      {
        role: roles.receiver,
        connId: this.connId,
        signed: this.signed
      }
    )
  }

  on (signal, fn) {
    this.socket.on(signal, fn)
  }

  off (signal) {
    this.socket.off(signal)
  }

  send (signal, data) {
    this.socket.send(signal, data)
  }

  /*
  ===================================================================================
    WebRTC
  ===================================================================================
  */
 
  async answer (offer) {
    return await this.peer.answer(offer)
  }

  onRTC (signal, fn) {
    this.peer.on(signal, fn)
  }
  
}