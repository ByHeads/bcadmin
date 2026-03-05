// Core API types

// --- Module types ---

export interface ModuleInfo {
  IsInstalled: boolean
  IsRunning: boolean
  CurrentVersion: string
  Version: string
  DeployedVersions: string[]
  LaunchedVersion: string
  IsActive?: boolean
  [key: string]: unknown
}

export interface WpfClientModule extends ModuleInfo {
  ExternalClients: ExternalClient[]
}

export interface ExternalClient {
  InstallDir: string
  Version: string
  IsVersionTracked: boolean
}

export interface MachineModule {
  OsStatus: OsStatus
  [key: string]: unknown
}

export interface OsStatus {
  OS: string
  OsVersion: string
  Architecture: string
  DotNetVersion: string
  [key: string]: unknown
}

export interface ReplicationModule {
  IsActive: boolean
  ReplicationVersion: string
  AwaitsInitialization: boolean
  [key: string]: unknown
}

export interface DownloadProgress {
  Progress: number
  [key: string]: unknown
}

export interface Modules {
  Receiver: ModuleInfo
  WpfClient: WpfClientModule
  PosServer: ModuleInfo
  CustomerServiceApplication: ModuleInfo
  Machine: MachineModule
  Replication: ReplicationModule
  Downloads: Record<string, DownloadProgress>
  [key: string]: unknown
}

// --- Resource types ---

export interface Receiver {
  WorkstationId: string
  LastActive: string
  Modules: Modules
}

export interface ReceiverLog {
  WorkstationId: string
  IsConnected?: boolean
  HasError: boolean
  LastActive: string
  Modules: Modules
}

export interface BroadcasterConfig {
  Version: string
  ComputerName: string
  [key: string]: unknown
}

export interface BroadcasterUpdate {
  Version: string
  RuntimeId: string
  FullName: string
  IsInstalled: boolean
}

export interface NotificationLog {
  Id: string
  TimestampUtc: string
  Message: string
}

export interface ReplicationState {
  WorkstationId: string
  AwaitsInitialization: boolean
  IsInSequence?: boolean
  IsBlocked: boolean
  RequiresPosServerUpdate: boolean
  ApplicableCount: number
  NonApplicableCount: number
  IncludedInFilter: boolean
  IsConnected?: boolean
  LastReceived?: string
  LastActive: string
  PosServerVersion: string
  ReplicationVersion: string
}

export interface DeploymentFile {
  Name: string
  Type: string
  ProductName: string
  Version: string
  RuntimeId: string
  Length: number
}

export interface LaunchSchedule {
  ProductName: string
  Version: string
  RuntimeId: string
  DateTime: string
}

export interface DependencyStatus {
  CurrentPolicy: string
  HasPowerShell: boolean
  HasVcRedistx64: boolean
  HasVcRedistx86: boolean
  HasBcman: boolean
  LastUpdated: string
}

export interface DependencyUpdate {
  IsNewerThanCurrent: boolean
  [key: string]: unknown
}

export interface AvailableResource {
  Name: string
  Kind: string
  Methods: string[]
}

export interface LogFileEntry {
  Name: string
  [key: string]: unknown
}

export interface ConnectionAttempt {
  WorkstationId: string
  Ip: string
  Token: string
  Time: string
  RecentForeignReplacementsCount: number
  [key: string]: unknown
}

export interface FeedMessage {
  WorkstationId: string
  ReceivedUtc: string
  MessageType: string
  Message: unknown
  [key: string]: unknown
}

// --- Replication types ---

export interface ReplicationSequence {
  Start: number
  End: number
  FileCount: number
  MaxNumberOfReplicationFiles: number
}

export interface CheckRetailConnectionResult {
  Status: 'Connected' | 'NotConfigured' | 'Unreachable' | 'Unauthorized' | 'InternalError'
  Message?: string
  [key: string]: unknown
}

export interface ReplicationFilter {
  EnabledRecipients: string[]
  [key: string]: unknown
}

export interface DownloadLimiterState {
  MaxSeats: number
  AvailableSeats: number
  ActiveDownloads: string[]
}

// --- Remote deployment request types ---

export interface RemoteInstallRequest {
  Workstations: string[]
  Product: string
  Version?: string
  Runtime?: string
  Parameters?: Record<string, unknown>
  BroadcasterUrl?: string
  InstallToken?: string
}

export interface RemoteUninstallRequest {
  Workstations: string[]
  Legacy?: boolean
  Product?: string
  ManualClientName?: string
}

export interface RemoteControlRequest {
  Workstations: string[]
  Command: 'start' | 'stop' | 'restart'
  Product: string
}

export interface ManualLaunchRequest {
  Workstations: string[]
  Product: string
  Version: string
}

export interface ResetRequest {
  Workstations: string[]
}

export interface CloseDayJournalRequest {
  Workstations: string[]
  PosUser: string
  PosPassword: string
}

// --- Remote deployment response types ---

export interface ExecutedScriptResponse {
  ExecutedScript: {
    ExecutedBy: string
    ExecutedSuccessfully: boolean
    Errors: string[]
  }
}

export interface ManualLaunchResponse {
  Launching: boolean
  ErrorMessage: string | null
  Workstations: string[]
}
