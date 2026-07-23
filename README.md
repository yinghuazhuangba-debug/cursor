# 鲜邻超市 · 销售管理系统

面向小超市/便利店的轻量销售管理软件。支持浏览器使用，也可打包为 Windows 本地安装程序（`.exe`）。

## 功能

- **经营概览**：今日营业额、订单数、低库存预警、支付方式分布
- **收银台**：扫码/搜索加购、快捷选品、多支付方式收款、找零
- **商品管理**：新增/编辑/删除商品，按分类与关键词筛选
- **库存管理**：入库、出库、盘点置数，库存流水记录
- **销售记录**：按日期与支付方式筛选，查看订单明细

## 浏览器使用

```bash
npm install
npm run dev
```

浏览器打开终端提示的本地地址即可。

## Windows 桌面版（exe）

在 **Windows** 电脑上执行：

```bash
npm install
npm run dist:win
```

完成后在 `release/` 目录生成：

| 文件 | 说明 |
|------|------|
| `鲜邻超市销售管理-1.0.0-win-x64.exe` | NSIS 安装包（可安装到本机） |
| `鲜邻超市销售管理-1.0.0-portable.exe` | 绿色免安装版（解压即用） |

仅打绿色版：

```bash
npm run dist:win:portable
```

开发时以桌面窗口调试：

```bash
npm run dev:desktop
```

> 说明：
> - **绿色版**（`portable`）可在 Linux / Windows 上交叉构建，得到可双击运行的 `.exe`
> - **NSIS 安装包**建议在 Windows 本机执行 `npm run dist:win`（Linux 需安装 Wine）

## 技术说明

- React 19 + TypeScript + Vite + Electron
- 数据持久化：`localStorage`（键名 `xianlin-supermarket-v1`）
- 首次打开会载入示例商品，可在概览页底部重置
