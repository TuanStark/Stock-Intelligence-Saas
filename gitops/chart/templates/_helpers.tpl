{{/*
Expand the name of the chart.
*/}}
{{- define "stock-intel.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "stock-intel.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "stock-intel.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "stock-intel.labels" -}}
helm.sh/chart: {{ include "stock-intel.chart" . }}
app.kubernetes.io/name: {{ include "stock-intel.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/part-of: stock-intelligence
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels for a component
Usage: {{ include "stock-intel.selectorLabels" (dict "context" . "component" "api") }}
*/}}
{{- define "stock-intel.selectorLabels" -}}
app.kubernetes.io/name: {{ include "stock-intel.name" .context }}
app.kubernetes.io/instance: {{ .context.Release.Name }}
app.kubernetes.io/component: {{ .component }}
{{- end }}

{{/*
Construct full image reference for a component
Usage: {{ include "stock-intel.image" (dict "global" .Values.global.image "component" .Values.api.image "defaultTag" .Chart.AppVersion) }}
*/}}
{{- define "stock-intel.image" -}}
{{- $registry := default (default "docker.io" .global.registry) .component.registry -}}
{{- $repository := .component.repository -}}
{{- $tag := default (default .defaultTag .global.tag) .component.tag -}}
{{- if $registry -}}
{{- printf "%s/%s:%s" $registry $repository $tag -}}
{{- else -}}
{{- printf "%s:%s" $repository $tag -}}
{{- end -}}
{{- end }}

{{/*
Secret Name Helper
*/}}
{{- define "stock-intel.secretName" -}}
{{- if .Values.secrets.existingSecret -}}
{{- .Values.secrets.existingSecret -}}
{{- else -}}
{{- printf "%s-secrets" (include "stock-intel.fullname" .) -}}
{{- end -}}
{{- end }}

{{/*
ConfigMap Name Helper
*/}}
{{- define "stock-intel.configMapName" -}}
{{- printf "%s-config" (include "stock-intel.fullname" .) -}}
{{- end }}

{{/*
ServiceAccount Name Helpers — one per component.
automountServiceAccountToken: false enforced on all pods (zero-trust).
*/}}
{{- define "stock-intel.serviceAccountName.api" -}}
{{- printf "%s-api" (include "stock-intel.fullname" .) -}}
{{- end }}

{{- define "stock-intel.serviceAccountName.web" -}}
{{- printf "%s-web" (include "stock-intel.fullname" .) -}}
{{- end }}

{{- define "stock-intel.serviceAccountName.worker" -}}
{{- printf "%s-worker" (include "stock-intel.fullname" .) -}}
{{- end }}
