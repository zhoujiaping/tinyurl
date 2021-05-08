这是一个短网址的应用实现（部分实现）。

短网址原理及实现
https://zhuanlan.zhihu.com/p/67919615?from_voters_page=true

一般，有进制算法、hash算法、随机数算法
进制算法如果不考虑自定义短网址的情况，是一个非常好的算法，它不会出现短网址冲突。
但是考虑自定义短网址的情况，会出现短网址冲突。

hash算法和随机数算法，都无法避免短网址冲突。

本项目基于进制算法作了优化，在支持自定义网址的同时，非常好的解决了短网址冲突的问题。
在出现短网址冲突的情况下，同样能保证短网址生成的性能。

优化的方法，就是新增一个短网址占用表，记录短网址被哪个自增id占用。然后当某个id生成短网址时，如果该短网址被占用，
它就会使用占用该短网址的id去生成短网址。
这样一借一还，就保证了每次生成短网址的耗费的操作次数是几乎一样的。

具体过程，可以参考tinyurl.jpg


