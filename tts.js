const { serviceTTS } = require('./serviceTTS');

module.exports = async (request, response) => {
  console.debug(`请求正文：${request.body}`)
  let voiceName = request.query["voiceName"] ?? "zh-CN-XiaoxiaoNeural"
  let style = request.query["style"] ?? "cheerful"
  let role = request.query["role"] ?? "Boy"
  let text = request.query["text"] ?? ""

  try {
    let format = request.headers["format"] || "audio-24khz-48kbitrate-mono-mp3"
    let ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xmlns:emo="http://www.w3.org/2009/10/emotionml" xml:lang="zh-CN"><voice name="${voiceName}"><s /><mstts:express-as role="${role}" style="${style}">${text}</mstts:express-as><s /></voice></speak>`

    let result = await serviceTTS.convert(ssml, format)

    response.sendDate = true
    response
      .status(200)
      .setHeader("Content-Type", format)
    response.end(result)
  } catch (error) {
    console.error(`发生错误, ${error.message}`)
    response.status(503).json(error)
  }
}

