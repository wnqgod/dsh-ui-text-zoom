# dsh-ui-text-zoom

DSH (DeepSeek Harness) Web UI 缩放插件：在设置页提供一个「界面缩放」滑块，实时放大/缩小整个界面（文字、图标、间距），无需重启。缩放比例按当前窗口高度自适应上限，弹窗不会超出窗口。

## 功能

- 设置 → 界面缩放：滑块 + 数字输入，实时生效
- 缩放范围 80%–160%，上限随窗口高度自动调整（弹窗不超窗）
- 值持久化到 `settings.yaml` 的 `ui-text-zoom` 命名空间
- 订阅设置变化，外部修改自动重应用

## 安装

```powershell
# 装进 web profile（tgz 路径按实际位置改）
dsh plugin --profile web add dsh-ui-text-zoom-0.1.0.tgz
```

重启 DSH 后，打开 设置 → 界面缩放 即可使用。

## 源码结构

```
index.js            host 端：注册 ui-text-zoom 设置命名空间 + 白名单补丁
client.js           browser 端：设置卡片（滑块）+ 实时应用 zoom
cordis.patch.yml    bundle 挂载声明
vendor/             dsh-host-apiproxy 白名单补丁脚本
```

## 手动安装（无 dsh CLI）

1. 把 `dsh-ui-text-zoom` 文件夹复制到 `<profile>/node_modules/`
2. 在 profile 的 `cordis.patch.yml` 追加：
   ```yaml
   - insert:
       - id: ui-text-zoom
         name: 'dsh-ui-text-zoom'
         config:
           zoom: 1.1
   ```
3. 重启 DSH

## License

MIT
