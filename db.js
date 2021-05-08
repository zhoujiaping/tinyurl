const mysql = require('mysql');
const log = require('./log');
const logger = log.defaultLogger;//使用默认日志记录器
const db = {};
var pool  = mysql.createPool({  //创建连接池
  connectionLimit : 10,
  host            : 'localhost',
  user            : 'root',
  password        : '123456',
  database        : 'test',
  charset		  : 'utf8'
});
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
db.conn = async function(){
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
db.doInTx = function(cb){
	return new Promise((resolve,reject)=>{
		db.conn().then(conn=>{
			conn.beginTransaction(async(err)=>{
				if(err){
					conn.release();
					await cb(err,null);
					return;
				}
				try{
					const res = await cb(null,conn);
					conn.commit((err)=>{
						logger.info('commit');
						conn.release();
						if(err){
							logger.error(err);
							reject(err);
							return;
						}
						resolve(res);
					});
				}catch(e){
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
				}
			});
		},async err=>{
			await cb(err,null);
		});
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
async function query({conn,sql,params}){
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