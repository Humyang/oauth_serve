var koa = require('koa')
var koaRouter = require('koa-router')
// var koaBody = require('koa-body')
var body = require('koa-better-body')
var mongo = require('koa-mongo')
var cors = require('koa-cors')

var CONSTANT = require('./constant.js')
var DAY = CONSTANT.DAY
var CODE = CONSTANT.CODE

const app = new koa();
const router = new koaRouter();
const PORT = 3000;

var md5 = require('md5')
var uid = require('uid2')

var CONFIG = require('./config.js')
var verifyUserName = require('./method.js').verifyUserName

var VERIFY = {
	isEmpty:function(val){
    if( val === undefined ||
        val === "" ||
        val === null){
        return true
    }
    return false
},
	loginVerify:function(username,password){
    if(this.isEmpty(username) || this.isEmpty(password)){
        return false
    }
    return true
}
}

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

function login_check(){
    return async function(ctx,next){

        let token = ctx.request.fields.token
        let _login_check_res = await ctx.mongo
                    .db(CONFIG.dbname)
                    .collection('logined_token')
                    .findOne({token:token})

        if(_login_check_res === null){
            // throw new Error('未登陆')
            throwError(CODE.LOGIN_NO_LOGIN)
        }
        if(_login_check_res.status === false){
            throwError(CODE.LOGIN_TOKEN_INVALID)
        }

       // 将登录信息传递给上下文
        ctx.LOGIN_STATUS = {
            uid:_login_check_res.uid,
            username:_login_check_res.username
        }

        await next()
    }
}
async function lc(ctx,token){

    let _login_check_res = await ctx.mongo
                    .db(CONFIG.dbname)
                    .collection('logined_token')
                    .findOne({'token':token})

    if(_login_check_res === null){
        throwError(CODE.LOGIN_NO_LOGIN)
    }
    if(_login_check_res.status === false){
        throwError(CODE.LOGIN_TOKEN_INVALID)
    }
    return {
        uid:_login_check_res.uid,
        username:_login_check_res.username
    }
}
router.post('/token_verify',async function(ctx){
    // ctx.body=true
    // debugger
    console.log('token_verify',ctx.request.fields)
    let token = ctx.request.fields.token

    let o = await lc(ctx,token)
    console.log(o)
    ctx.body = o
})
router.post('/login',async function(ctx){

	let fields = ctx.request.fields
    //验证码
    let username = fields.username
    let password = fields.password

    //密码参数基本判断 不允许密码为空
    if(!VERIFY.loginVerify(username,password)){
        throwError(CODE.LOGIN_EMPTY)
    }

    //获取 salt
    let salt = await ctx.mongo
                        .db(CONFIG.dbname)
                        .collection('user')
                        .findOne({username:username})
    if(salt === null){
        throwError(CODE.USERNAME_NO_FIND)
    }
    // // console.log('salt，',salt)
    // // console.log('encryptPassword',encryptPassword(fields.password,salt.salt))
    //验证账号密码
    let _usm_pwd_filter = {
        username:username,
        password:encryptPassword(password,salt.salt)
    }
    // console.log('_usm_pwd_filter: ',_usm_pwd_filter)
    let _usm_pwd = await ctx.mongo 
                        .db(CONFIG.dbname)
                        .collection('user')
                        .findOne(_usm_pwd_filter);
    // // console.log('_usm_pwd，',_usm_pwd)
    if(_usm_pwd === null){
        // throw new Error('账号密码错误')
        throwError(CODE.USERNAME_ERROR)
    }

    debugger
    //token 写入有效状态
    let new_token = uid(40)
    console.log(new_token)
    let _token_stauts = {
        username:username,
        status:true,
        token:new_token,
        uid:_usm_pwd.uid
        // ,
        // device:fields.device
    }
    // console.log('new_token',new_token)

    // 不使旧token失效，因为要支持多设备登录
    // let _remove_token = yield this.mongo
    //                             .db(CONFIG.dbname)
    //                             .collection('logined_token')
    //                             .update({
    //                                     username:fields.username,
    //                                     device:fields.device
    //                                 },
    //                                     {'$set':{status:false}},
    //                                     {'upsert':false})

    // // console.log('_remove_token: ',_remove_token)
    let _insert_res = await ctx.mongo
                    .db(CONFIG.dbname)
                    .collection('logined_token')
                    .insert(_token_stauts)
    // // console.log('_insert_res',_insert_res)

    // 登录成功
    ctx.body = {
      status:true,
      token:new_token
    }
});
router.post('/regiest',async function(ctx){
	debugger
	let fields = ctx.request.fields
    // let fields = this.request.fields
    //验证码
    let username = fields.username
    let password = fields.password
    if(!VERIFY.loginVerify(username,password)){
        throwError(CODE.LOGIN_EMPTY)
    }
    //验证码检查
    // let verifycode = yield verify_code(this,fields.token,fields.verify_code)
    // // console.log('verifycode',verifycode)

    // 验证账号格式
    if(!verifyUserName(fields.username)){
        // throw new Error('账号格式不符合要求');
        throwError(CODE.USERNAME_INVALID)
    }
    // 验证密码格式


    // 验证账号重复性
    let _username = await username_check(ctx,fields.username)

    // // console.log('_username：',_username)
    if(_username!=null){
        throwError(CODE.USERNAME_REPTER)
    }

    let salt = md5(Math.random()*1000000)
    password = encryptPassword(fields.password,salt)
    let now = new Date()

    let uid2 = uid(40)

    let data = {
        username:fields.username,
        password,
        salt,
        uid:uid2,
        regiest_date:now.getTime()
        // 弹性添加其它字段
    }
    // 账号写入数据库
    let _inset_res = await ctx.mongo
                    .db(CONFIG.dbname)
                    .collection('user')
                    .insert(data)

    let temptoken = await get_verifytoken(ctx)

    // 响应
    ctx.body = {
      status:true,
      res:_inset_res,
      temp_token:temptoken.token,
      temp_verifycode:temptoken.verify_code
    }
});
async function get_verifytoken(ctx){
    // 生成 Token
    let token = uid(40)
    
    // 生成 验证码
    let verify_code = "123456"
    // 验证码转换为 base64 图片
    // Token，verify_code 存入数据库

    let now = new Date()
    let create_time = now.getTime()
    let expire_time = create_time + DAY*1
    let data = {
        token,
        verify_code,
        create_time,
        expire_time,
        is_verify:false
    }

    let res = await ctx.mongo
                    .db(CONFIG.dbname)
                    .collection('token')
                    .insert(data)

    return {token,verify_code}
}
// 密码加密
function encryptPassword(password,salt){
    return md5(md5(password+salt))
}
//检查重复用户名
async function username_check(ctx,username){
    let username_query_filter = {
        username
    }
    let res = await ctx.mongo 
                    .db(CONFIG.dbname)
                    .collection('user')
                    .findOne(username_query_filter)
    return res
}

// async function username_repeat(next){
//     let _username = await username_check(this,this.params.username)
//     // // console.log('_username：',_username)
//     if(_username!=null){
//         throw new Error('账号重复');
//     }
//     this.body = {
//         status:true
//     }
// }





// router.get('/',async function(ctx){
// 	ctx.throw(402, 'access_denied', { user: '4444' });
// });




app.use(cors())

app.on('error', async (err,ctx,next) =>{

  	console.error('server error', err)
  	// console.log(ctx,c)
  	ctx.body = err
  	// await next()
  }
);
app.use(mongo())
app.use(body());

app.use(async function (ctx,next){
    try{
        await next()
    }catch (err) {
        try{
            // 业务逻辑错误
            ctx.body = objectAssign({status:false},JSON.parse(err.message));
        }catch(err2){
            // console.log(this)
            ctx.body = {
                status:false,
                msg:err.message,
                path:ctx.request.url
            }
        }
        console.log(err)
    }
})

app.use(router.routes());
app.use(router.allowedMethods());
app.listen(PORT);

console.log('Running a API server at localhost:3000');