const mysql = require('mysql');
const log = require('./log');
const {als} = require('./als');
const logger = log.newLogger('db');
const db = {};
var pool  = mysql.createPool({  //创建连接池
  connectionLimit : 10,
  host            : 'localhost',
  user            : 'root',
  password        : '123456',
  database        : 'test',
  charset		  : 'utf8'
});
//const {als} = require('./als');
//const {getCtx,withCtx} = require('./ctx')

/*
const conn = mysql.createConnection({
	host:'localhost',
	user:'root',
	password:'',
	database:'jyd'
});
conn.connect();
*/

//获取连接
db.conn = function(){
	return new Promise((resolve,reject)=>{
		pool.getConnection(function(err, conn) {
			if (err) {
				reject(err);
			}else{
				resolve(conn);
			}
		});
	});
};
//在事务中执行
db.doInTx = function(afterBeginTx){
	let ctx = als.getStore()
	console.info('uid='+ctx.uid)
	return new Promise((resolve,reject)=>{
		db.conn().then(conn=>{
			//console.info(`dddddddddddddddddddddd=>${als.getStore().uid}`)
			/**
			原来mysql这个库不太兼容AsyncLocalStorage(mysql这个库自己实现了一个事件队列。。。)
			*/
			conn.beginTransaction((err)=>{
				//再调用一下als.run，解决兼容问题
				als.run(ctx,()=>{
					//console.info(`bbbbbbbbbbbbbbbbbbbbb=>${als.getStore().uid}`)
					if(err){
						conn.release();
						reject(err)
						return;
					}

					return afterBeginTx(conn).then(res=>{
						conn.commit((err)=>{
							//再调用一下als.run，解决兼容问题
							als.run(ctx,()=>{
								logger.info('commit');
								conn.release();
								if(err){
									logger.error(err);
									reject(err);
									return;
								}
								resolve(res);
							})
						});
					}).catch(e=>{
						conn.rollback(err=>{
							logger.info('rollback');
							conn.release();
							if(err){
								logger.error(err);
								reject(err);
								return;
							}
							reject(e);
						});
					});
				});
			});
		}).catch(err=>reject(err));
	});
};
//批量插入。这里其实还可以优化一下，可以支持设置批量数，数据太多分多次批量操作插入。
db.insert = async function({conn,tablename,columns,values}){
	let {sql,params} = genInsertSql({tablename,columns,values});
	//logger.info(sql);
	//logger.info(JSON.stringify(params,null,2));
	try{
		let rows = await query({conn,sql,params});
		return rows;
	}catch(e){
		if(e.code == 'PARSER_JS_PRECISION_RANGE_EXCEEDED'){
			logger.error(JSON.stringify(e));
		}else{
			throw e;
		}
	}
	return;
};
//生成批量插入的sql
function genInsertSql({tablename,columns,values}){
	const columnnames = columns.join(',');
	const sql = `insert into ${tablename}(${columnnames})values `;
	const params = [];
	const placeholders = [];
	values.forEach((item,index)=>{
		let holder = [];
		for(let i=0;i<columns.length;i++){
			holder.push('?');
			params.push(item[columns[i]]);
		}
		placeholders.push('('+holder.join(',')+')');
	});
	const ret = {
		sql:sql+placeholders.join(',')+';',
		params:params
	};
	//logger.info(ret);
	return ret;
}
//查询操作
function query({conn,sql,params}){
	return new Promise((resolve,reject)=>{
		conn.query(sql,params,(err,res)=>{
			if(err){
				reject(err);
				return;
			}
			//logger.info(res);
			//logger.info(JSON.stringify(res,null,2));
			resolve(res);
		});
	});
}
db.query = query;
db.pool = pool;
module.exports = db;
//query方法和insert方法，其实还可以优化。可以去掉conn参数，每次获取连接的时候，生成一个标识，将连接保存到一个对象，然后查询和插入的时候，根据标识从中获取它，释放连接的时候，根据标识将其从对象中删除。