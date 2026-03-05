import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import enCommon from './en/common.json'
import enNav from './en/nav.json'
import enOverview from './en/overview.json'
import enDeploy from './en/deploy.json'
import enDashboards from './en/dashboards.json'
import enDeployment from './en/deployment.json'
import enNotifications from './en/notifications.json'
import enLogs from './en/logs.json'
import enConnection from './en/connection.json'
import enSettings from './en/settings.json'
import enReceivers from './en/receivers.json'
import enReplication from './en/replication.json'
import enTerminals from './en/terminals.json'

import svCommon from './sv/common.json'
import svNav from './sv/nav.json'
import svOverview from './sv/overview.json'
import svDeploy from './sv/deploy.json'
import svDashboards from './sv/dashboards.json'
import svDeployment from './sv/deployment.json'
import svNotifications from './sv/notifications.json'
import svLogs from './sv/logs.json'
import svConnection from './sv/connection.json'
import svSettings from './sv/settings.json'
import svReceivers from './sv/receivers.json'
import svReplication from './sv/replication.json'
import svTerminals from './sv/terminals.json'

i18n.use(initReactI18next).init({
  resources: {
    en: {
      common: enCommon,
      nav: enNav,
      overview: enOverview,
      deploy: enDeploy,
      dashboards: enDashboards,
      deployment: enDeployment,
      notifications: enNotifications,
      logs: enLogs,
      connection: enConnection,
      settings: enSettings,
      receivers: enReceivers,
      replication: enReplication,
      terminals: enTerminals
    },
    sv: {
      common: svCommon,
      nav: svNav,
      overview: svOverview,
      deploy: svDeploy,
      dashboards: svDashboards,
      deployment: svDeployment,
      notifications: svNotifications,
      logs: svLogs,
      connection: svConnection,
      settings: svSettings,
      receivers: svReceivers,
      replication: svReplication,
      terminals: svTerminals
    }
  },
  lng: localStorage.getItem('bcadmin-lang') ?? 'en',
  fallbackLng: 'en',
  defaultNS: 'common',
  interpolation: { escapeValue: false }
})

export default i18n
