/** 大屏 demo 的模拟数据。集中放，便于 demo 复用与调整。 */

export const hourlyTrend = {
  categories: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '24:00'],
  series: [
    { name: '访问量', data: [1200, 820, 3400, 5600, 4800, 6200, 3100] },
    { name: '下单量', data: [320, 180, 940, 1620, 1380, 1860, 820] },
  ],
}

export const regionSales = {
  categories: ['华东', '华南', '华北', '西南', '华中', '东北'],
  series: [{ name: '销售额', data: [4820, 3610, 2470, 1980, 1620, 940] }],
}

export const channelShare = [
  { name: '直营', value: 4820 },
  { name: '分销', value: 3610 },
  { name: '电商', value: 2470 },
  { name: '门店', value: 1980 },
]

export const topProducts = [
  { name: '智能终端 A1', value: 12480 },
  { name: '工业传感器 B2', value: 9860 },
  { name: '网关设备 C3', value: 7240 },
  { name: '边缘计算节点', value: 5820 },
  { name: '数据采集器 D5', value: 4310 },
]

export const alerts = [
  { label: '华东节点 CPU 使用率超阈值', value: '92%', meta: '2 分钟前', status: 'danger' as const },
  { label: '华北仓储库存低于安全线', value: '128', meta: '8 分钟前', status: 'warning' as const },
  { label: '支付网关响应延迟升高', value: '380ms', meta: '12 分钟前', status: 'warning' as const },
  { label: '西南区域订单同步完成', value: '1,284', meta: '15 分钟前', status: 'success' as const },
  { label: '新增渠道接入审核通过', value: '3', meta: '22 分钟前', status: 'info' as const },
  { label: '夜间批量任务执行成功', value: 'OK', meta: '1 小时前', status: 'success' as const },
  { label: '数据库主从延迟恢复正常', value: '12ms', meta: '1 小时前', status: 'success' as const },
  { label: '华南节点内存使用率 78%', value: '78%', meta: '2 小时前', status: 'info' as const },
]
