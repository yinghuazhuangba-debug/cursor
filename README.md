# 鲜邻超市 · 销售管理系统

面向小超市/便利店的轻量销售管理软件。支持浏览器使用，也可打包为 Windows 本地程序（`.exe`）。

## 功能

- **经营概览**：今日营业额、订单数、低库存预警、支付方式分布
- **收银台**：扫码/搜索加购、快捷选品、多支付方式收款、找零
- **商品管理**：新增/编辑/删除商品，按分类与关键词筛选
- **库存管理**：扫码入库/出库/盘点，库存流水记录
- **收银台**：扫描包装二维码或条码加购收款

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
