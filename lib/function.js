const axios = require('axios');
const fetch = require('node-fetch');
const fs = require('fs');
const cheerio = require('cheerio');
const FormData = require('form-data');
/**
 * Checks if a string is a valid URL.
 * @param {string} url The string to validate.
 * @returns {boolean}
 */
const isUrl = (url) => {
    return url.match(new RegExp(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/, 'gi'));
};



/**
 * Fetches JSON from a URL.
 * @param {string} url The URL to fetch from.
 * @returns {Promise<object>}
 */
const fetchJson = async (url) => {
    try {
        const res = await fetch(url);
        return await res.json();
    } catch (e) {
        throw `Error fetching JSON from ${url}`;
    }
};



const getGroupAdmins = (participants) => {
        let admins = []
        for (let i of participants) {
            i.admin === "superadmin" ? admins.push(i.id) :  i.admin === "admin" ? admins.push(i.id) : ''
        }
        return admins || []
     }



/**
 * Downloads a file from a URL and returns it as a buffer.
 * @param {string} url The URL of the file.
 * @returns {Promise<Buffer>}
 */
const getBuffer = async (url) => {
    const res = await axios.get(url, { responseType: 'arraybuffer' });
    return res.data;
};

const bytesToSize = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const getSizeMedia = (path) => {
    return new Promise((resolve, reject) => {
        if (/http/.test(path)) {
            axios.get(path)
                .then((res) => {
                    const length = parseInt(res.headers['content-length']);
                    const size = bytesToSize(length, 3);
                    if (!isNaN(length)) resolve(size);
                });
        } else if (Buffer.isBuffer(path)) {
            const length = Buffer.byteLength(path);
            const size = bytesToSize(length, 3);
            if (!isNaN(length)) resolve(size);
        } else {
            reject('error gatau apah');
        }
    });
};



/**
 * Formats uptime from seconds to a human-readable string.
 * @param {number} seconds - Total seconds.
 * @returns {string}
 */
const formatRuntime = (seconds) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor(seconds % (3600 * 24) / 3600);
    const m = Math.floor(seconds % 3600 / 60);
    const s = Math.floor(seconds % 60);
    return `${d}d ${h}h ${m}m ${s}s`;
};

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}




async function uploadImage(buffer) {
    const { fileTypeFromBuffer } = await import('file-type');
    const type = await fileTypeFromBuffer(buffer);
    if (!type) {
        throw new Error("Could not determine file type from buffer.");
    }
    let form = new FormData();
    form.append('file', buffer, `tmp.${type.ext}`);    
    let res = await fetch('https://telegra.ph/upload', {
        method: 'POST',
        body: form
    });    
    let img = await res.json();
    if (img.error) throw img.error;
    return 'https://telegra.ph' + img[0].src;
}



async function ephoto(url, text) {
    try {
        // GET request to get session cookies and form tokens
        let gT = await axios.get(url, {
            headers: {
                "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36"
            }
        });
        const $ = cheerio.load(gT.data);
        const token = $("input[name=token]").val();
        const build_server = $("input[name=build_server]").val();
        const build_server_id = $("input[name=build_server_id]").val();

        //  POST request to the same URL to get the next form data
        let form = new FormData();
        form.append("text[]", text);
        form.append("token", token);
        form.append("build_server", build_server);
        form.append("build_server_id", build_server_id);

        let res = await axios({
            url: url,
            method: "POST",
            data: form,
            headers: {
                "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36",
                "cookie": gT.headers["set-cookie"]?.join("; "),
                ...form.getHeaders()
            }
        });

        // Scrape the response from Step 2 to get the final image-generation parameters
        const $$ = cheerio.load(res.data);
        const json_val = $$("input[name=form_value_input]").val();
        if (!json_val) {
             throw new Error("Could not find 'form_value_input'. Ephoto360 structure may have changed.");
        }
        const json = JSON.parse(json_val);
        json["text[]"] = json.text;
        delete json.text;

        //  Final POST to the image creation endpoint
        const { data } = await axios.post("https://en.ephoto360.com/effect/create-image", new URLSearchParams(Object.entries(json)), {
            headers: {
                "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36",
                "cookie": gT.headers["set-cookie"].join("; ")
            }
        });

        // Return the full URL to the created image
        return build_server + data.image;

    } catch (error) {
        console.error("Ephoto Function Error:", error);
        throw new Error("Failed during ephoto image generation process.");
    }
}



/**
 * Searches for images on Pinterest.
 * @param {string} query The search query.
 * @returns {Promise<string[]>} An array of image URLs.
 */
async function pinterest(query) {
    return new Promise(async (resolve, reject) => {
        try {
            const res = await fetchJson(`https://api.pinterest.com/v3/search/pins/?q=${query}&rs=ac&len=2`);
            const results = res.data.results.map(v => v.images["237x"].url);
            resolve(results);
        } catch (e) {
            reject(e);
        }
    });
}


  const sendFile = async (jid, path, filename = '', caption = '', quoted, ptt = false, options = {}) => {
let type = await MrPasqua.getFile(path, true)
let { res, data: file, filename: pathFile } = type
if (res && res.status !== 200 || file.length <= 65536) {
try { throw { json: JSON.parse(file.toString()) } }
catch (e) { if (e.json) throw e.json }
}
let opt = { filename }
if (quoted) opt.quoted = quoted
if (!type) options.asDocument = true
let mtype = '', mimetype = type.mime, convert
if (/webp/.test(type.mime) || (/image/.test(type.mime) && options.asSticker)) mtype = 'sticker'
else if (/image/.test(type.mime) || (/webp/.test(type.mime) && options.asImage)) mtype = 'image'
else if (/video/.test(type.mime)) mtype = 'video'
else if (/audio/.test(type.mime)) (
convert = await (ptt ? toPTT : toAudio)(file, type.ext),
file = convert.data,
pathFile = convert.filename,
mtype = 'audio',
mimetype = 'audio/ogg; codecs=opus'
)
else mtype = 'document'
if (options.asDocument) mtype = 'document'

let message = {
...options,
caption,
ptt,
[mtype]: { url: pathFile },
mimetype
}
let m
try {
m = await MrPasqua.sendMessage(jid, message, { ...opt, ...options })
} catch (e) {
console.error(e)
m = null
} finally {
if (!m) m = await MrPasqua.sendMessage(jid, { ...message, [mtype]: file }, { ...opt, ...options })
return m
}
}
    
  const getFile = async (PATH, save) => {
  let res
  let data = Buffer.isBuffer(PATH) 
    ? PATH 
    : /^data:.*?\/.*?;base64,/i.test(PATH) 
      ? Buffer.from(PATH.split(',')[1], 'base64') 
      : /^https?:\/\//.test(PATH) 
        ? await (res = await getBuffer(PATH)) 
        : fs.existsSync(PATH) 
          ? (filename = PATH, fs.readFileSync(PATH)) 
          : typeof PATH === 'string' 
            ? PATH 
            : Buffer.alloc(0)
  
  let type = await FileType.fromBuffer(data) || { mime: 'application/octet-stream', ext: '.bin' }
  
  filename = path.join(__dirname, './tmp/media/' + new Date().getTime() + '.' + type.ext)
  
  if (data && save) fs.promises.writeFile(filename, data)
  
  return { res, filename, size: await getSizeMedia(data), ...type, data }
}


module.exports = {
    isUrl,
    fetchJson,
    getBuffer,
    bytesToSize,
    getSizeMedia,
    formatRuntime,
    formatBytes,
    uploadImage,
    sendFile,
    getFile,
    getGroupAdmins,
    ephoto, 
    pinterest,
};