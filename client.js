/**
 * dsh-ui-text-zoom — browser half.
 *
 * Renders a "界面缩放" section inside the Web UI settings page: a slider
 * (and a number input) editing the `ui-text-zoom` settings namespace
 * through the settings scope transport. Every change applies a global
 * `zoom` style on the app root immediately — no restart needed.
 *
 * The zoom factor is stored in settings.yaml (namespace `ui-text-zoom`,
 * field `zoom`, 0.8..1.6). The client subscribes to the scope so external
 * edits (or a later settings load) also re-apply.
 *
 * Window adaptivity: the slider's upper bound is derived from the current
 * window height so the settings dialog (and other full-height overlays)
 * never grow beyond the viewport — the whole point of the zoom is
 * readability, and a dialog taller than the window defeats that. The
 * computed cap is `window.innerHeight / DIALOG_BASE_HEIGHT`, clamped to
 * [MIN, MAX]; on a ~1050px-tall viewport that yields ~1.14, matching where
 * overflow actually begins. The persisted value is never clamped on load
 * (an external edit may exceed the cap; the UI shows it but further moves
 * snap to the cap).
 *
 * Hand-written in the lazy-CJS bundle protocol
 * (window.__ModuleLoader__.load), so no build step and no imports from
 * dsh client packages.
 */
window.__ModuleLoader__.load({
  id: 'dsh-ui-text-zoom',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    var react = require('react')
    var h = react.createElement

    // ── CSS (theme tokens) ────────────────────────────────────────────────
    var CSS =
      '.__utz_root{max-width:640px;display:flex;flex-direction:column;gap:14px}' +
      '.__utz_field{display:flex;flex-direction:column;gap:6px}' +
      '.__utz_label{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary)}' +
      '.__utz_row{display:flex;align-items:center;gap:12px}' +
      '.__utz_range{flex:1;accent-color:var(--dsw-alias-state-business-primary)}' +
      '.__utz_num{width:80px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);border-radius:8px;padding:5px 8px;font:inherit;font-size:13px;text-align:right}' +
      '.__utz_hint{font-size:11px;color:var(--dsw-alias-label-tertiary)}' +
      '.__utz_status{font-size:12px;color:var(--dsw-alias-label-tertiary)}' +
      '.__utz_error{font-size:12px;color:var(--dsw-alias-state-error-primary)}' +
      '.__utz_unavailable{font-size:13px;color:var(--dsw-alias-label-tertiary)}'
    var tagId = 'dsh-ui-text-zoom/main.css'
    if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css=' + JSON.stringify(tagId) + ']') === null) {
      var tag = document.createElement('style')
      tag.dataset.plugin = 'dsh-ui-text-zoom'
      tag.dataset.pluginCss = tagId
      tag.textContent = CSS
      document.head.appendChild(tag)
    }

    // ── locale ────────────────────────────────────────────────────────────
    var NS = 'uiTextZoom'
    var inject = ['slots', 'locale', 'settingsScope']
    var zh = {
      nav: '界面缩放',
      intro: '整体放大/缩小界面文字与元素。拖动滑块立即生效，无需重启（写入 settings.yaml 的 ui-text-zoom 命名空间）。',
      zoomLabel: '缩放比例',
      hint: '100% 为原始大小。上限根据当前窗口高度自动调整，保证弹窗不超过窗口。',
      saved: '已保存',
      saving: '保存中…',
      error: '保存失败',
      unavailable: '设置命名空间不可用（服务端未注册 ui-text-zoom 命名空间？）',
      overridden: '已覆盖',
      loading: '加载中…',
      reset: '恢复默认'
    }
    var en = {
      nav: 'UI Zoom',
      intro: 'Zoom the whole interface text and elements. The slider applies immediately, no restart needed (persisted in the ui-text-zoom settings namespace).',
      zoomLabel: 'Zoom factor',
      hint: '100% is the original size. The upper bound adapts to the current window height so dialogs never exceed the window.',
      saved: 'Saved',
      saving: 'Saving…',
      error: 'Save failed',
      unavailable: 'Settings namespace unavailable (ui-text-zoom namespace not registered server-side?)',
      overridden: 'overridden',
      loading: 'Loading…',
      reset: 'Reset'
    }

    // ── constants ─────────────────────────────────────────────────────────
    var MIN = 0.8
    var MAX = 1.6
    var STEP = 0.05
    var DEFAULT = 1.1
    var ZOOM_STYLE_ID = 'dsh-ui-text-zoom/zoom.css'
    // The reference full-height overlay we keep inside the window: a dialog
    // that would fill roughly 85% of a 1080px viewport (~920px) must never
    // exceed the actual viewport. zoomFactor cap = viewportH / this base.
    var DIALOG_BASE_HEIGHT = 920

    function round2(v) {
      return Math.round(v * 100) / 100
    }

    // The dynamic upper bound: derived from the layout viewport height so
    // that full-height overlays stay inside the window at any zoom.
    function maxZoomFor(windowHeight) {
      var h = Number(windowHeight)
      if (!Number.isFinite(h) || h <= 0) return MAX
      var cap = h / DIALOG_BASE_HEIGHT
      return Math.min(MAX, Math.max(MIN, cap))
    }

    function clampToHard(v) {
      var n = Number(v)
      if (!Number.isFinite(n)) return DEFAULT
      return Math.min(MAX, Math.max(MIN, n))
    }

    // Clamp an in-UI move to the dynamic cap (never below MIN).
    function clampToUi(v, cap) {
      var n = Number(v)
      if (!Number.isFinite(n)) return DEFAULT
      var lo = MIN
      var hi = Math.max(lo, cap)
      return Math.min(hi, Math.max(lo, n))
    }

    function applyZoom(zoom) {
      var rounded = round2(zoom)
      var existing = document.querySelector('style[data-plugin-css=' + JSON.stringify(ZOOM_STYLE_ID) + ']')
      if (existing) existing.remove()
      var style = document.createElement('style')
      style.dataset.plugin = 'dsh-ui-text-zoom'
      style.dataset.pluginCss = ZOOM_STYLE_ID
      // `zoom` reflows layout like a browser zoom. Because vh units scale
      // with zoom, a `max-height: 90vh` dialog becomes 90vh * zoom in
      // effect and can outgrow the window; counter-scale common full-height
      // overlay containers so they stay within the viewport. The selector
      // targets fixed-position overlay roots (dialogs, drawers) without
      // touching page content flow.
      style.textContent =
        'html{zoom:' + rounded + '}' +
        'html,body{overflow:auto !important}' +
        '[data-dsh-modal],' +
        '[role="dialog"],' +
        '[data-dsh-overlay],' +
        '.dsh-modal,' +
        '.dsh-dialog{' +
        '  max-height:calc(100vh / ' + rounded + ') !important;' +
        '  height:auto !important;' +
        '  overflow-y:auto !important;' +
        '}'
      document.head.appendChild(style)
    }

    // ── component ─────────────────────────────────────────────────────────
    function ZoomSection(props) {
      var t = props.t
      var scope = props.scope
      var [snapshot, setSnapshot] = react.useState(function () { return scope.getSnapshot() })
      var ready = snapshot.status === 'ready' && snapshot.value !== void 0
      var value = snapshot.value || {}
      var user = snapshot.user || {}
      // `draft` is the currently displayed value shared by the slider and
      // the number box, so moving one immediately moves the other. It
      // starts from the persisted value and is replaced whenever the scope
      // publishes a change.
      var [draft, setDraft] = react.useState(function () { return round2(clampToHard(value.zoom)) })
      var [notice, setNotice] = react.useState(null)
      var [error, setError] = react.useState(null)
      var saveTimer = null

      // The dynamic cap from the actual window height, recomputed on
      // resize. This is the heart of the fix: the slider's max follows the
      // window, so dialogs can never overflow it.
      var [cap, setCap] = react.useState(function () {
        return round2(maxZoomFor(window.innerHeight))
      })

      react.useEffect(function () {
        function onResize() {
          setCap(round2(maxZoomFor(window.innerHeight)))
        }
        window.addEventListener('resize', onResize)
        return function () { window.removeEventListener('resize', onResize) }
      }, [])

      // Initial: apply whatever the settings currently hold.
      react.useEffect(function () {
        if (ready) applyZoom(clampToHard(value.zoom))
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [ready])

      // Keep the draft in sync with scope changes.
      react.useEffect(function () {
        if (ready) setDraft(round2(clampToHard(value.zoom)))
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [ready, value.zoom])

      react.useEffect(function () {
        scope.load()
        var alive = true
        var sync = function () { if (alive) setSnapshot(scope.getSnapshot()) }
        var un = typeof scope.subscribe === 'function' ? scope.subscribe(sync) : null
        return function () {
          alive = false
          if (un) un()
          if (scope.dispose) scope.dispose()
        }
      }, [scope])

      react.useEffect(function () {
        return function () {
          if (saveTimer) clearTimeout(saveTimer)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])

      if (snapshot.status === 'unavailable') {
        return h('p', { className: '__utz_unavailable' }, t('unavailable'))
      }
      if (!ready) return h('p', { className: '__utz_status' }, t('loading'))

      function onZoomChange(next) {
        // Moves from the UI snap to the dynamic cap; a persisted value that
        // came from elsewhere is allowed to display above the cap but any
        // new move clamps it.
        var zoom = clampToUi(next, cap)
        var target = round2(zoom)
        setDraft(target)
        applyZoom(target)
        setNotice(null)
        setError(null)
        if (saveTimer) clearTimeout(saveTimer)
        var current = round2(clampToHard(value.zoom))
        if (target === current) return
        saveTimer = setTimeout(function () {
          scope.set('zoom', target).then(function () {
            setNotice(t('saved'))
            if (scope.load) scope.load()
          }).catch(function (e) {
            setError(t('error') + ': ' + String(e && e.message || e))
          })
        }, 300)
      }

      function onReset() {
        setDraft(DEFAULT)
        applyZoom(DEFAULT)
        setNotice(null)
        setError(null)
        if (saveTimer) clearTimeout(saveTimer)
        scope.unset('zoom').then(function () {
          setNotice(t('saved'))
          if (scope.load) scope.load()
        }).catch(function (e) {
          setError(t('error') + ': ' + String(e && e.message || e))
        })
      }

      var overridden = 'zoom' in user
      var display = draft
      var sliderMax = Math.max(cap, MIN)
      // Round the cap to the slider step so the thumb can actually reach it.
      var stepCap = Math.round(sliderMax / STEP) * STEP

      return h('div', { className: '__utz_root' },
        h('p', { className: '__utz_hint', style: { margin: '0 0 2px' } }, t('intro')),
        h('div', { className: '__utz_field' },
          h('span', { className: '__utz_label' },
            t('zoomLabel'),
            overridden ? h('span', { style: { marginLeft: 6, fontSize: 10, color: 'var(--dsw-alias-state-business-primary)' } }, t('overridden')) : null
          ),
          h('div', { className: '__utz_row' },
            h('input', {
              className: '__utz_range',
              type: 'range',
              min: MIN, max: stepCap, step: STEP,
              value: Math.min(display, stepCap),
              onChange: function (e) { onZoomChange(Number(e.target.value)) }
            }),
            h('input', {
              className: '__utz_num',
              type: 'number',
              min: MIN, max: stepCap, step: STEP,
              value: display,
              onChange: function (e) { onZoomChange(Number(e.target.value)) }
            }),
            h('span', { className: '__utz_hint' }, Math.round(display * 100) + '%')
          ),
          h('span', { className: '__utz_hint' }, t('hint'))
        ),
        h('div', { style: { display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 } },
          h('button', {
            type: 'button',
            style: {
              border: '1px solid var(--dsw-alias-border-l2)',
              background: 'var(--dsw-alias-bg-layer-3)',
              color: 'var(--dsw-alias-label-primary)',
              borderRadius: 8, padding: '5px 12px', font: 'inherit', fontSize: 12, cursor: 'pointer'
            },
            onClick: onReset
          }, t('reset')),
          notice ? h('span', { className: '__utz_status' }, notice) : null,
          error ? h('span', { className: '__utz_error' }, error) : null
        )
      )
    }

    // ── plugin ────────────────────────────────────────────────────────────
    function apply(ctx) {
      var t = ctx.locale.bind(NS)
      ctx.effect(function () { return ctx.locale.register(NS, { zh: zh, en: en }) }, 'dsh-ui-text-zoom: dictionaries')
      var scope = ctx.settingsScope.bind({ namespace: 'ui-text-zoom' })
      ctx.slots.inject('settings.section', function () {
        return ctx.slots.register({
          name: 'settings.section',
          id: 'ui-text-zoom',
          order: 26,
          label: function () { return t('nav') },
          locale: NS
        }, function (props) {
          return h(ZoomSection, Object.assign({}, props, { scope: scope }))
        })
      })
    }

    exports.apply = apply
    exports.inject = inject
    return module.exports
  }
})
