const db = require('./db');
const log = require('./log');
const logger = log.defaultLogger;
//作为短网址的字符（一共62个，我们的短网址最多6位，所以可以生成62的6次方个短网址）
const chars = `0123456789abcdegfhijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ`.split(new RegExp('','igm'));

//模拟业务
//给定长网址，生成短网址。这里还有工作没完成，只是生成了短网址的一部分，没有处理网址协议部分
async function generateTinyUrl({longUrl}){
	if(!longUrl){
		throw new Error(`invalid longUrl => ${longUrl}`);
	}
	
	return await db.doInTx(async (conn)=>{	
		//如果长网址已经关联了短网址，则直接返回
		let req = {
			conn,
			sql:'select * from t_tiny_url where long_url = ?',
			params:[longUrl]
		};
		let rows = await db.query(req);
		if(rows.length > 0){
			logger.info(`this longUrl is exsits => ` + JSON.stringify(rows));
			return rows;
		}
		//获取下一个自增id
		let tablename = 't_tiny_url';
		let columns = ['long_url'];
		let values = [{
			long_url:longUrl
		}];
		rows = await db.insert({conn,tablename,columns,values});
		//logger.info(rows);
		let id = rows.insertId;
		//计算短网址
		//logger.info(id);
		let tinyUrl = toTinyUrl(id);
		//判断短网址是否存在（由于支持自定义短网址，可能id对应的短网址已经被其他长网址关联了）
		req.sql = 'select * from t_tiny_url where tiny_url = ?';
		req.params = [tinyUrl];
		rows = await db.query(req);
		//如果短网址已经被值为i的id关联使用，就使用i生成的短网址。意思是谁用了我的票（短网址），我就要用他的票。
		//如果他的票被别人用了，我就把它们作为一个整体。这样只要票被用了，就一定能找到一个未被使用的票。
		if(rows.length > 0){
			//寻找使用了我的票的家伙
			req.sql = 'select * from t_tiny_url_occupy where tiny_url = ?';
			req.params = [tinyUrl];
			rows = await db.query(req);
			const _tinyUrl = tinyUrl;
			const _id = rows[0].occupy_id;
			tinyUrl = toTinyUrl(_id);
			logger.info(`id=>${id},tinyUrl=>${tinyUrl}`);
			//req.sql = 'update t_tiny_url_occupy set occupy_id = ? where tiny_url = ?';
			//req.params = [id,_tinyUrl];
            //别人使用了我的票，我用了他们的票，扯平了，这些信息不需要了。
			req.sql = 'delete from t_tiny_url_occupy where occupy_id = ?';
			req.params = [_id];
			await db.query(req);
		}
		//logger.info(tinyUrl);
		//logger.info(db);
		//保存短网址
		req.sql = 'update t_tiny_url set tiny_url = ? where id = ?';
		req.params = [tinyUrl,id];
		await db.query(req);
		return tinyUrl;
	})
	
}
//自定义短码
async function customTinyUrl({tinyUrl,longUrl}){
	if(!longUrl){
		throw new Error(`invalid longUrl => ${longUrl}`);
	}
	if(!tinyUrl || !/[0-9a-zA-Z]{1,6}/.test(tinyUrl)){
		throw new Error(`invalid tinyUrl => ${tinyUrl}`);
	}

	return await db.doInTx(async (conn)=>{
		//如果短网址或者长网址已经存在，就直接返回
		let req = {
			conn,
			sql:'select * from t_tiny_url where tiny_url = ? or long_url = ?',
			params:[tinyUrl,longUrl]
		};
		let rows = await db.query(req);
		if(rows.length > 0){
			logger.info(`this tinyUrl/longUrl is exsits => ` + JSON.stringify(rows));
			return rows;
		}
		let tablename = 't_tiny_url';
		let columns = ['tiny_url','long_url'];
		let values = [{
			long_url:longUrl,tiny_url:tinyUrl
		}];
		//获取下一个自增id
		rows = await db.insert({conn,tablename,columns,values});
		//logger.info(rows);
		let id = rows.insertId;
		//logger.info(id);
		//计算短网址对应的数值
		let occupyId = fromTinyUrl(tinyUrl);
		//假设当前递增id为id0,使用短网址为tinyurl15（自定义的）,
		//由于id0使用了短网址tinyurl15，如果id0的短网址tinyurl0被idx使用了，那就改为是idx使用了tinyurl15。
		//id0占用谁的短网址了，别的id也占用id0的短网址了。
		req.sql = 'update t_tiny_url_occupy set occupy_id = ? where occupy_id = ?';
		req.params = [id,occupyId];
		logger.info(`req.params=${req.params}`);
		rows = await db.query(req);
		logger.info('=>'+JSON.stringify(rows));
		//如果id0的短网址没被别的id占用，那就声明一下，id0占用了tinyurl15。
		if(rows.affectedRows == 0){
			tablename = 't_tiny_url_occupy';
			columns = ['tiny_url','occupy_id'];
			values = [{
				tiny_url:tinyUrl,
				occupy_id:id
			}];
			//
			rows = await db.insert({conn,tablename,columns,values});
		}
		return rows;
	});
}
//根据数值计算短网址，当然这里并没有处理协议部分
function toTinyUrl(id){
	let n = id;
	let code = '';
	let size = chars.length;
	while(n > 0){
		code += chars[n%size];
		n = 0|(n/size);
	}
	return [...code].reverse().join('');
}
//根据短网址，计算数值
function fromTinyUrl(tinyUrl){
	const chs = [...tinyUrl];
	//logger.info(`chs=>${chs}`);
	//logger.info(Array.isArray(chs));
	let res = chs.map(ch=>chars.indexOf(ch));
	logger.info(`res=>${res}`);
	res = res.reduce((prev,curr)=>{
		return prev*chars.length+curr;
	},0);
	logger.info(`res=>${res}`);
	return res;
}
//测试
let test = async function(){
	//await generateTinyUrl('http://www.test.com/4');
	//await generateTinyUrl('http://www.test.com/1');
	//await generateTinyUrl('http://www.test.com/2');
	//await generateTinyUrl('http://www.test.com/x');

	await customTinyUrl('4','http://www.test.com/1');
	await customTinyUrl('1','http://www.test.com/2');
	await customTinyUrl('2','http://www.test.com/3');
	//await customTinyUrl('1','http://www.test.com/4');
	await generateTinyUrl('http://www.test.com/4');

}
test = async function(){
	await customTinyUrl('5','http://www.test.com/1');
	await customTinyUrl('1','http://www.test.com/2');
	await customTinyUrl('2','http://www.test.com/3');
	//await customTinyUrl('1','http://www.test.com/4');
	await generateTinyUrl('http://www.test.com/4');
	await generateTinyUrl('http://www.test.com/5');

}
/*
test = function(){
	const id = fromTinyUrl('abc');
	logger.info(id);
}*/
//test();
/*
test().then(data=>{
	logger.info(data);
},err=>{
	logger.error(err);
});*/
module.exports = {
	generateTinyUrl,customTinyUrl
};