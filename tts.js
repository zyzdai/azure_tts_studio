const { serviceTTS } = require('./serviceTTS');

module.exports = async (request, response) => {
    let voiceName = request.body["voiceName"] ?? "zh-CN-XiaoxiaoNeural"
  let style = request.body["style"] ?? "General"
  let role = request.body["role"] ?? ""
  let rate = request.body["rate"] ?? "0"
  let styledegree = request.body["styledegree"] ?? "1.5"
  let pitch = request.body["pitch"] ?? "0"
  let text = request.body["text"] ?? ""
  let format = request.body["format"] ?? "audio-24khz-48kbitrate-mono-mp3"
  try {
    let ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts"
xmlns:emo="http://www.w3.org/2009/10/emotionml" xml:lang="zh-CN">
	<voice name="${voiceName}">
		<s />
		<mstts:express-as role="${role}" style="${style}" styledegree="${styledegree}">
      <prosody rate="${rate}%" pitch="${pitch}%">
				${text}
			</prosody>
		</mstts:express-as>
		<s />
	</voice>
</speak>`
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

