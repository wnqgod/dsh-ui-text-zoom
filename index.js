/**
 * dsh-ui-text-zoom — host half.
 *
 * Registers the `ui-text-zoom` settings namespace (zoom factor, 0.8..1.6)
 * so the Web settings surface can edit it and the value persists in
 * settings.yaml. The client half (client.js) renders the settings section
 * and applies the zoom live. Because dsh-host-apiproxy only exposes
 * namespaces on its hard-coded WEB_SETTINGS_NAMESPACES allowlist, we
 * idempotently patch that list on every start (self-heals after dsh
 * updates overwrite the file).
 */
import z from '@deepseek-ai/schemastery'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import { ensureSettingsNamespaceExposed } from './vendor/dsh-settings-expose.js'

const name = 'ui-text-zoom'
/** Settings namespace owned by this plugin (Web UI settings section). */
const NS = settingsNamespace('ui-text-zoom')
/** Must declare the settings service so installSettingsSection can inject it. */
const inject = ['settings']

/** Runtime schema for the ui-text-zoom row. */
const Config = z.object({
  /** Global zoom factor applied to the Web UI (1.1 = 110%). */
  zoom: z.number().min(0.8).max(1.6).default(1.1),
})

function apply(ctx, config) {
  console.log('[ui-text-zoom] host apply invoked, zoom config =', config?.zoom)
  console.log('[ui-text-zoom] ctx.inject available =', typeof ctx.inject)
  // settings-backed configuration: the composition entry stays the `base`
  // layer; a registered `ui-text-zoom` settings section (Web UI section,
  // settings.yaml) overlays it live, so edits hot-apply without a restart.
  let current = config
  let sourceGetter = null
  const getConfig = () => (sourceGetter ? sourceGetter() : current)
  installSettingsSection(ctx, NS, Config, config, {
    setSource: (getter) => {
      sourceGetter = getter
    },
    onChange: () => {},
  })

  // dsh-host-apiproxy hard-codes which settings namespaces the Web client
  // may see; without this, the settings section answers `settings-not-exposed`
  // on any stock install. Patch the allowlist idempotently (self-heals after
  // dsh updates overwrite the file).
  ensureSettingsNamespaceExposed(ctx, 'ui-text-zoom', ctx.logger)
}

export { Config, apply, inject, name }
