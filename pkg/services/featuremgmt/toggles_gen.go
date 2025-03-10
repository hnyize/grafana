// NOTE: This file is autogenerated

package featuremgmt

const (
	// FlagTrimDefaults
	// Use cue schema to remove values that will be applied automatically
	FlagTrimDefaults = "trimDefaults"

	// FlagEnvelopeEncryption
	// encrypt secrets
	FlagEnvelopeEncryption = "envelopeEncryption"

	// FlagHttpclientproviderAzureAuth
	// use http client for azure auth
	FlagHttpclientproviderAzureAuth = "httpclientprovider_azure_auth"

	// FlagServiceAccounts
	// support service accounts
	FlagServiceAccounts = "service-accounts"

	// FlagDatabaseMetrics
	// Add prometheus metrics for database tables
	FlagDatabaseMetrics = "database_metrics"

	// FlagDashboardPreviews
	// Create and show thumbnails for dashboard search results
	FlagDashboardPreviews = "dashboardPreviews"

	// FlagDashboardPreviewsScheduler
	// Schedule automatic updates to dashboard previews
	FlagDashboardPreviewsScheduler = "dashboardPreviewsScheduler"

	// FlagDashboardPreviewsAdmin
	// Manage the dashboard previews crawler process from the UI
	FlagDashboardPreviewsAdmin = "dashboardPreviewsAdmin"

	// FlagLiveConfig
	// Save grafana live configuration in SQL tables
	FlagLiveConfig = "live-config"

	// FlagLivePipeline
	// enable a generic live processing pipeline
	FlagLivePipeline = "live-pipeline"

	// FlagLiveServiceWebWorker
	// This will use a webworker thread to processes events rather than the main thread
	FlagLiveServiceWebWorker = "live-service-web-worker"

	// FlagQueryOverLive
	// Use grafana live websocket to execute backend queries
	FlagQueryOverLive = "queryOverLive"

	// FlagPanelTitleSearch
	// Search for dashboards using panel title
	FlagPanelTitleSearch = "panelTitleSearch"

	// FlagTempoSearch
	// Enable searching in tempo datasources
	FlagTempoSearch = "tempoSearch"

	// FlagTempoBackendSearch
	// Use backend for tempo search
	FlagTempoBackendSearch = "tempoBackendSearch"

	// FlagTempoServiceGraph
	// show service
	FlagTempoServiceGraph = "tempoServiceGraph"

	// FlagLokiBackendMode
	// Loki datasource works as backend datasource
	FlagLokiBackendMode = "lokiBackendMode"

	// FlagAccesscontrol
	// Support robust access control
	FlagAccesscontrol = "accesscontrol"

	// FlagPrometheusAzureAuth
	// Use azure authentication for prometheus datasource
	FlagPrometheusAzureAuth = "prometheus_azure_auth"

	// FlagInfluxdbBackendMigration
	// Query InfluxDB InfluxQL without the proxy
	FlagInfluxdbBackendMigration = "influxdbBackendMigration"

	// FlagNewNavigation
	// Try the next gen navigation model
	FlagNewNavigation = "newNavigation"

	// FlagShowFeatureFlagsInUI
	// Show feature flags in the settings UI
	FlagShowFeatureFlagsInUI = "showFeatureFlagsInUI"

	// FlagDisableHttpRequestHistogram
	// Do not create histograms for http requests
	FlagDisableHttpRequestHistogram = "disable_http_request_histogram"

	// FlagValidatedQueries
	// only execute the query saved in a panel
	FlagValidatedQueries = "validatedQueries"

	// FlagSwaggerUi
	// Serves swagger UI
	FlagSwaggerUi = "swaggerUi"

	// FlagFeatureHighlights
	// Highlight Enterprise features
	FlagFeatureHighlights = "featureHighlights"

	// FlagMigrationLocking
	// Lock database during migrations
	FlagMigrationLocking = "migrationLocking"
)
