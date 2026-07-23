# 鲜邻超市 · 销售管理系统

面向小超市/便利店的轻量销售管理软件。支持浏览器使用，也可打包为 Windows 本地程序（`.exe`）。

## 功能

- **经营概览**：今日营业额、订单数、低库存预警、支付方式分布
- **收银台**：扫码加购；瓶码按瓶价、箱码按建档箱价
- **商品管理**：瓶码/箱码/箱规；名称模糊查码；分类可维护
- **库存管理**：整箱+散装入库（支持不满一箱）
- **销售记录**：按日期与支付方式筛选
- **经营报表**：日/月/年销售额与利润，支持自定义统计周期

## 数据存储

| 运行方式 | 存储位置 |
|----------|----------|
| **Windows 桌面版（exe）** | 本机 SQLite 文件 **`ledger.db`**（商品 / 库存流水 / 销售单） |
| 浏览器预览 | `localStorage`（仅开发调试用） |

桌面版可在「经营概览」：

- 查看当前 `ledger.db` 路径
- **另存到…**（复制当前数据到新位置）
- **打开已有…**（切换到已有数据库文件）
- **恢复默认**

配置保存在 `%APPDATA%\\鲜邻超市销售管理\\settings.json`。  
默认数据库：`%APPDATA%\\鲜邻超市销售管理\\ledger.db`

## 浏览器使用

```bash
npm install
npm run dev
```

## Windows 桌面版（exe）

```bash
npm install
npm run dist:win:portable
```

产物在 `release/`：`鲜邻超市销售管理-x.y.z-portable.exe`

桌面调试：

```bash
npm run dev:desktop
```

## 技术说明

- React 19 + TypeScript + Vite + Electron
- 桌面版：`sql.js` 写入本地 `ledger.db`
- 首次打开会载入示例商品，可在概览页底部重置
