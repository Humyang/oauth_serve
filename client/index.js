var uid = require('uid2')
var mongo = require('koa-mongo')
const http = require('http');
var CONFIG = require('./config.js')
var CODE = require('./code.js')
let login_status = 'logined_token'
function throwError(obj,msg){
    let nObj = {
        STATUSCODE:obj.STATUSCODE,
        MSG:obj.MSG
    }
    if(msg != undefined){
        nObj.MSG = nObj.MSG + msg
    }
    throw new Error(JSON.stringify(nObj))
}
async function fetchToeknStatus(ctx,token){
	return new Promise(function(reslove,reject){
		const body = JSON.stringify({
		  'token': token
		});
		let _config = ctx._config
		const options = {
		  hostname: _config.server.url,
		  port: _config.server.port,
		  path: _config.server.path,
		  method: 'POST',
		  headers: {
		    'Content-Type': 'application/json',
		    "Content-Length": Buffer.byteLength(body)
		  }
		};
		const req = http.request(options, (res) => {
		  let data = ''
		  res.setEncoding('utf8');
		  res.on('data', (chunk) => {
		  	data = chunk
		  });
		  res.on('end', () => {
		  	reslove(JSON.parse(data))
		  });
		});
		req.on('error', (e) => {
			reject(e.message)
		});
		req.end(body);
	})
}

function oauth_client(_options){

	return async function(ctx,next){
		let _config = Object.assign(CONFIG,_options)
		ctx._config = _config

		//来自oauth_server的tokenA
		let tokenA = ctx.request.fields.token
		debugger

		// 调用 oauth_server 的接口验证 tokenA 状态
		let tokenA_verify = await fetchToeknStatus(ctx,tokenA)
		let tokenB = uid(40)

		let obj = {
			tokenB,
			tokenA,
			username:tokenA_verify.username,
			uid:tokenA_verify.uid
		}
		// 写入登录状态
		let _insert_res = await ctx.mongo
	                    .db(_config.dbname)
	                    .collection(login_status)
	                    .insert(obj)

		
	                    debugger
		// 返回tokenB给前端
		ctx.body={
			status:true,
			token:tokenB,
			username:tokenA_verify.username,
			uid:tokenA_verify.uid
		}
	}
}
async function login_check(ctx,token){
	if(!!!token){
		console.log('!!!token:',token)
		throwError(CODE.LOGIN_TOKEN_INVALID)
	}
    let _login_check_res = await ctx.mongo
                .db(ctx._config.dbname)
                .collection(login_status)
                .findOne({"token":token})

    console.log(_login_check_res)
    if(_login_check_res === null){
        throwError(CODE.LOGIN_NO_LOGIN)
    }
    if(_login_check_res.status === false){
		console.log('!!!_login_check_res')
        throwError(CODE.LOGIN_TOKEN_INVALID)
    }
    return _login_check_res
}
function oauth_login_check(_options){
	return async function(ctx,next){
		ctx._config = Object.assign(CONFIG,_options)
		let token = ctx.header._token
		let _login_check_res = await login_check(ctx,token)
		// if(!!!token){

		//             throwError(CODE.LOGIN_TOKEN_INVALID)
		// }
  //       let _login_check_res = await ctx.mongo
  //                   .db(_config.dbname)
  //                   .collection(login_status)
  //                   .findOne({"tokenB":token})

  //       console.log(_login_check_res)
  //       if(_login_check_res === null){
  //           throwError(CODE.LOGIN_NO_LOGIN)
  //       }
  //       if(_login_check_res.status === false){
  //           throwError(CODE.LOGIN_TOKEN_INVALID)
  //       }

        // 将登录信息传递给上下文
		ctx.LOGIN_STATUS = {
			uid:_login_check_res.uid,
			username:_login_check_res.username
		}
		await next()
	}
}

module.exports = {
	oauth_client,
	oauth_login_check,
	login_check
}