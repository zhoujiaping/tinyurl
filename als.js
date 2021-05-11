const { AsyncLocalStorage } = require('async_hooks');

const als = new AsyncLocalStorage()
/**
async_hooks模块用来做解决了异步调用上下文的问题

*/
module.exports = {
	als	
}
