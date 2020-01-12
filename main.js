'use strict';

require('date-utils');
require('dotenv').config();
const rp = require('request-promise');
const fs = require('fs');
const sharp = require("sharp");
const commandLineArgs = require('command-line-args');
const twitter = require('twitter');

const optionDefinitions = [
  {
    name: 'user',
    type: String
  },
  {
    name: 'graphid',
    type: String,
  }
];

const options = commandLineArgs(optionDefinitions);

let PIXELA_USER = getOptionValue('user');
let PIXELA_GRAPH_ID = getOptionValue('graphid');

const client = new twitter({
  consumer_key: getEnvValue('TWITTER_CONSUMER_KEY'),
  consumer_secret: getEnvValue('TWITTER_CONSUMER_SECRET'),
  access_token_key: getEnvValue('TWITTER_ACCESS_TOKEN_KEY'),
  access_token_secret: getEnvValue('TWITTER_ACCESS_TOKEN_SECRET')
});

// 草を生やした数を取得する
let get_pixela_quantity = rp({
    uri: 'https://pixe.la/v1/users/' + PIXELA_USER + '/graphs/' + PIXELA_GRAPH_ID + '/stats',
    timeout: 30 * 1000,
    json: true
  }).then(function (res){
    let desc = res.todaysQuantity >= 1 ? 
      `今日は、${PIXELA_GRAPH_ID}で${res.todaysQuantity}回、草を生やすことができました！` :
      `今日は、${PIXELA_GRAPH_ID}で草を生やすことができませんでした…`;

    console.log('[SUCCESS] GET Quantity');

    return desc + '\nhttps://pixe.la/v1/users/' + PIXELA_USER + '/graphs/' + PIXELA_GRAPH_ID + '.html'
  }).catch(function (res){
    // 404だったら、pixelがないとみなす。
    if (res.statusCode == '404') return `今日は、${PIXELA_GRAPH_ID}で草を生やすことができませんでした…`;
    else {
      console.log('[ERROR] ' + res.message);
      process.exit(1);
    }
  });

// グラフの画像を取得する
let get_pixela_svg = rp({
    uri: 'https://pixe.la/v1/users/' + PIXELA_USER + '/graphs/' + PIXELA_GRAPH_ID + '?mode=short',
    timeout: 30 * 1000
  }).then(function (res){
    console.log('[SUCCESS] GET SVG');

    // SVGをPNGに変換
    return sharp(new Buffer(res))
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .resize(880)
      .png()
      .toBuffer();
  })

// Promise群を実行
Promise.all([
  get_pixela_quantity,
  get_pixela_svg
])
.then(function (res) {

  // Twitterに投稿
  (async () => {

    // 画像のアップロード
    const media = await client.post('media/upload', {media: res[1]});

    // Twitterに投稿
    const status = {
        status: res[0],
        media_ids: media.media_id_string // Pass the media id string
    }
    
    client.post('statuses/update', status);
  })();
})
.catch(function (err) {
    // API call failed...
    console.log(err);
    process.exit(1);
});

// 実行時引数から読み込むための関数
function getOptionValue(key) {
  let value = options[key];
  if (typeof value === 'undefined') {
      console.log(`${key} is not defined`);
      process.exit(1);
  }

  return value;
}

// .envから読み込むための関数
function getEnvValue(key) {
    let value = process.env[key];
    if (typeof value === 'undefined') {
        console.log(`${key} is not defined`);
        process.exit(1);
    }

    return value;
}