const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const { tmpdir } = require('os');
const { randomUUID } = require('crypto');

function getThumb(thumb) {
  return thumb || 'https://i.ibb.co/pRKvYt1/default-thumb.jpg';
}

function ensureTempDir() {
  const tempDir = path.join(tmpdir(), 'youtube-dl');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

async function fetchVreden(url, type = 'mp3') {
  const endpoint = type === 'mp3'
    ? 'https://api.vreden.my.id/api/ytmp3'
    : 'https://api.vreden.my.id/api/ytmp4';

  try {
    const { data } = await axios.get(endpoint, { params: { url }, timeout: 60000 });
    if (!data?.result?.status) throw new Error(`Vreden API failed`);
    
    const { metadata, download } = data.result;
    if (!download?.url) throw new Error('Download URL not found');
    
    return {
      download_url: download.url,
      original_filename: download.filename,
      title: metadata.title || 'video',
      thumbnail: metadata.thumbnail || metadata.image,
      source: 'vreden'
    };
  } catch (error) { throw error; }
}

async function fetchKyyOkatsu(url, type = 'mp3') {
  const endpoint = type === 'mp3'
    ? 'https://kyyokatsurestapi.my.id/downloader/ytmp3'
    : 'https://kyyokatsurestapi.my.id/downloader/ytmp4';

  try {
    const { data } = await axios.get(endpoint, { params: { url }, timeout: 30000 });
    if (!data?.status) throw new Error(`KyyOkatsu API failed`);
    
    if (type === 'mp3') {
      if (!data.dl) throw new Error('Download URL not found');
      return {
        download_url: data.dl,
        original_filename: `${data.title}.mp3`.replace(/[<>:"/\\|?*]/g, ''),
        title: data.title,
        thumbnail: data.thumb,
        source: 'kyyokatsu'
      };
    } else {
      if (!data.result?.mp4) throw new Error('Download URL not found');
      return {
        download_url: data.result.mp4,
        original_filename: `${data.result.title}.mp4`.replace(/[<>:"/\\|?*]/g, ''),
        title: data.result.title,
        thumbnail: data.thumb,
        source: 'kyyokatsu'
      };
    }
  } catch (error) { throw error; }
}

async function fetchDavidCyril(url, type = 'mp3') {
  try {
    if (type === 'mp3') {
      const { data } = await axios.get('https://apis.davidcyril.name.ng/download/ytmp3', { params: { url }, timeout: 30000 });
      if (!data?.success || !data?.result?.download_url) throw new Error('davidcyril MP3 response invalid');

      return {
        download_url: data.result.download_url,
        original_filename: `${data.result.title || 'audio'}.mp3`.replace(/[<>:"/\\|?*]/g, ''),
        title: data.result.title || 'audio',
        thumbnail: data.result.thumbnail,
        source: 'davidcyril'
      };
    } else {
      const { data } = await axios.get('https://apis.davidcyril.name.ng/download/ytmp4', { params: { url }, timeout: 30000 });
      if (!data?.success || !data?.result?.download_url) throw new Error('davidcyril MP4 response invalid');

      return {
        download_url: data.result.download_url,
        original_filename: `${data.result.title || 'video'}.mp4`.replace(/[<>:"/\\|?*]/g, ''),
        title: data.result.title || 'video',
        thumbnail: data.result.thumbnail,
        source: 'davidcyril'
      };
    }
  } catch (error) { throw error; }
}

async function fetchAgatz(url, type = 'mp3') {
  const endpoint = type === 'mp3'
    ? 'https://api.agatz.xyz/api/ytmp3'
    : 'https://api.agatz.xyz/api/ytmp4';

  try {
    const { data } = await axios.get(endpoint, { params: { url }, timeout: 30000 });
    if (data?.status !== 200 || !data?.data?.downloadUrl) throw new Error('agatz response invalid');

    const ext = type === 'mp3' ? 'mp3' : 'mp4';
    return {
      download_url: data.data.downloadUrl,
      original_filename: `${data.data.title || 'media'}.${ext}`.replace(/[<>:"/\\|?*]/g, ''),
      title: data.data.title || 'media',
      thumbnail: data.data.thumbnail,
      source: 'agatz'
    };
  } catch (error) { throw error; }
}

async function fetchDownloadUrl(url, type = 'mp3') {
  try { return await fetchVreden(url, type); }
  catch (e1) {
    try { return await fetchKyyOkatsu(url, type); }
    catch (e2) {
      try { return await fetchDavidCyril(url, type); }
      catch (e3) { return await fetchAgatz(url, type); }
    }
  }
}

async function downloadFile(url, outputPath) {
  const response = await axios({ method: 'GET', url, responseType: 'stream', timeout: 60000 });
  const writer = fs.createWriteStream(outputPath);
  response.data.pipe(writer);
  
  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
    response.data.on('error', reject);
  });
}

async function getYTAudioCompressed(url) {
  let tempInputPath, tempOutputPath;
  try {
    const { download_url, original_filename, title, thumbnail, source } = await fetchDownloadUrl(url, 'mp3');
    const tempDir = ensureTempDir();
    const uniqueId = randomUUID().substring(0, 8);
    
    const sanitizedFilename = original_filename.replace(/[<>:"/\\|?*]/g, '');
    tempInputPath = path.join(tempDir, `input_${uniqueId}_${sanitizedFilename}`);
    tempOutputPath = path.join(tempDir, `output_${uniqueId}_${sanitizedFilename}`);
    
    await downloadFile(download_url, tempInputPath);
    
    if (source === 'vreden') {
      await new Promise((resolve, reject) => {
        ffmpeg(tempInputPath)
          .audioCodec('libmp3lame')
          .audioBitrate('64k')
          .audioFrequency(44100)
          .audioChannels(2)
          .format('mp3')
          .outputOptions(['-preset veryfast', '-y'])
          .on('end', resolve)
          .on('error', reject)
          .save(tempOutputPath);
      });
    } else { tempOutputPath = tempInputPath; }
    
    return { buffer: fs.readFileSync(tempOutputPath), filename: original_filename, title, thumbnail, source };
  } finally {
    if (tempInputPath && fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
    if (tempOutputPath && fs.existsSync(tempOutputPath) && tempOutputPath !== tempInputPath) {
      fs.unlinkSync(tempOutputPath);
    }
  }
}

async function getYTVideoCompressed(url) {
  let tempInputPath, tempOutputPath;
  try {
    const { download_url, original_filename, title, thumbnail, source } = await fetchDownloadUrl(url, 'mp4');
    const tempDir = ensureTempDir();
    const uniqueId = randomUUID().substring(0, 8);
    
    const sanitizedFilename = original_filename.replace(/[<>:"/\\|?*]/g, '');
    tempInputPath = path.join(tempDir, `input_${uniqueId}_${sanitizedFilename}`);
    tempOutputPath = path.join(tempDir, `output_${uniqueId}_${sanitizedFilename}`);
    
    await downloadFile(download_url, tempInputPath);
    
    if (source === 'vreden') {
      await new Promise((resolve, reject) => {
        ffmpeg(tempInputPath)
          .videoCodec('libx264')
          .audioCodec('aac')
          .videoBitrate('300k')
          .audioBitrate('96k')
          .size('640x360')
          .format('mp4')
          .outputOptions(['-preset veryfast', '-crf 32', '-movflags +faststart', '-y'])
          .on('end', resolve)
          .on('error', reject)
          .save(tempOutputPath);
      });
    } else { tempOutputPath = tempInputPath; }
    
    return { buffer: fs.readFileSync(tempOutputPath), filename: original_filename, title, thumbnail, source };
  } finally {
    if (tempInputPath && fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
    if (tempOutputPath && fs.existsSync(tempOutputPath) && tempOutputPath !== tempInputPath) {
      fs.unlinkSync(tempOutputPath);
    }
  }
}

module.exports = { getYTAudioCompressed, getYTVideoCompressed, getThumb };