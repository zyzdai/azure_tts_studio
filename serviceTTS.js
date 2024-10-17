const { randomBytes } = require('crypto');
const WebSocket = require('ws');

class Service {
  ws = null
  timer = null
  constructor() {
    this.executorMap = new Map()
    this.bufferMap = new Map()
  }
  async connect() {
    const connectionId = randomBytes(16)
      .toString("hex")
      .toUpperCase()
    let url = `wss://koreacentral.api.speech.microsoft.com/cognitiveservices/websocket/v1?X-ConnectionId=${connectionId}`
    let ws = new WebSocket(url, {
      host: "koreacentral.api.speech.microsoft.com",
      origin: "https://speech.microsoft.com",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
      }
    })
    return new Promise((resolve, reject) => {
      ws.on("open", () => {
        resolve(ws)
      })
      ws.on("close", (code, reason) => {
        // 服务器会自动断开空闲超过30秒的连接
        this.ws = null
        if (this.timer) {
          clearTimeout(this.timer)
          this.timer = null
        }
        for (let [key, value] of this.executorMap) {
          value.reject(`连接已关闭: ${reason} ${code}`)
        }
        this.executorMap.clear()
        this.bufferMap.clear()
      })

      ws.on("message", (message, isBinary) => {
        let pattern = /X-RequestId:(?<id>[a-z|0-9]*)/
        if (!isBinary) {
          let data = message.toString()
          if (data.includes("Path:turn.start")) {
            // 开始传输
            let matches = data.match(pattern)
            let requestId = matches.groups.id
            this.bufferMap.set(requestId, Buffer.from([]))
          } else if (data.includes("Path:turn.end")) {
            // 结束传输
            let matches = data.match(pattern)
            let requestId = matches.groups.id

            let executor = this.executorMap.get(requestId)
            if (executor) {
              this.executorMap.delete(matches.groups.id)
              let result = this.bufferMap.get(requestId)
              executor.resolve(result)
            }
          }
        } else if (isBinary) {
          let separator = "Path:audio\r\n"
          let data = message
          let contentIndex = data.indexOf(separator) + separator.length

          let headers = data.slice(2, contentIndex).toString()
          let matches = headers.match(pattern)
          let requestId = matches.groups.id

          let content = data.slice(contentIndex)

          let buffer = this.bufferMap.get(requestId)
          if (buffer) {
            buffer = Buffer.concat([buffer, content])
            this.bufferMap.set(requestId, buffer)
          }
        }
      })
      ws.on("error", error => {
        reject(`连接失败： ${error}`)
      })
      ws.on("ping", data => {
        console.debug("ping %s", data)
      })
      ws.on("pong", data => {
        console.debug("pong %s", data)
      })
    })
  }

  async convert(ssml, format) {
    if (this.ws == null || this.ws.readyState != WebSocket.OPEN) {
      let connection = await this.connect()
      this.ws = connection
    }
    const requestId = randomBytes(16)
      .toString("hex")
      .toLowerCase()
    let result = new Promise((resolve, reject) => {
      // 等待服务器返回后这个方法才会返回结果
      this.executorMap.set(requestId, {
        resolve,
        reject
      })
      // 发送配置消息
      let configData = {
        context: {
          synthesis: {
            audio: {
              metadataoptions: {
                sentenceBoundaryEnabled: "false",
                wordBoundaryEnabled: "false"
              },
              outputFormat: format
            }
          }
        }
      }

      let configMessage =
        `X-Timestamp:${Date()}\r\n` +
        "Content-Type:application/json; charset=utf-8\r\n" +
        "Path:speech.config\r\n\r\n" +
        JSON.stringify(configData)
      this.ws.send(configMessage, configError => {
        if (configError) {
          console.error(`配置请求发送失败：${requestId}\n`, configError)
        }

        // 发送SSML消息
        let ssmlMessage =
          `X-Timestamp:${Date()}\r\n` +
          `X-RequestId:${requestId}\r\n` +
          `Content-Type:application/ssml+xml\r\n` +
          `Path:ssml\r\n\r\n` +
          ssml
        this.ws.send(ssmlMessage, ssmlError => {
          if (ssmlError) {
            console.error(`SSML消息发送失败：${requestId}\n`, ssmlError)
          }
        })
      })
    })

    // 收到请求，清除超时定时器
    if (this.timer) {
      clearTimeout(this.timer)
    }
    // 设置定时器，超过10秒没有收到请求，主动断开连接
    this.timer = setTimeout(() => {
      if (this.ws && this.ws.readyState == WebSocket.OPEN) {
        this.ws.close(1000)
        this.timer = null
      }
    }, 10000)

    let data = await Promise.race([
      result,
      new Promise((resolve, reject) => {
        // 如果超过 20 秒没有返回结果，则清除请求并返回超时
        setTimeout(() => {
          this.executorMap.delete(requestId)
          this.bufferMap.delete(requestId)
          reject("转换超时")
        }, 10000)
      })
    ])
    return data
  }
}
const serviceTTS = new Service()
module.exports = { serviceTTS };