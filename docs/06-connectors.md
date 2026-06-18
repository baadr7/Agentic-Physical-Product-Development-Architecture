# 06 — Generic Connector (Layer 3)

**Founding principle**: the app integrates with no specific software. Every external
system (PLM, ERP, CAD, AMDEC, MES, standards…) is abstracted behind a standardized
connector. In the demo all connectors are simulated; in production the real connector
is plugged in — the app does not change.

## Inbound connector (Read)

| Field | Type | Description |
|---|---|---|
| connector_id | string | Target system ID (e.g. 'PLM', 'ERP_SAV', 'AMDEC_TOOL', 'CAD', 'MES') |
| query_type | enum | Data type requested ('past_projects', 'failure_modes', 'complaints', 'standards', 'material_availability') |
| filters | object | Product family, date, criticality, status, industrial sector |
| max_results | int | Max expected results |

## Normalized response

| Field | Type | Description |
|---|---|---|
| source | string | Source system name + version (e.g. 'Windchill 12.1', 'SAP S/4HANA') |
| timestamp | ISO 8601 | Data date — mandatory for ADT traceability |
| data | array | Structured objects per query_type |
| confidence | float 0–1 | Optional relevance score from the source system |

## Outbound connector (Write / Notify)

| Field | Type | Description |
|---|---|---|
| connector_id | string | Target system |
| event_type | enum | 'concept_validated', 'simulation_done', 'redesign_triggered', 'gate_approved' |
| payload | object | Event data (Bs, concept_id, DFx scores…) |
| adt_entry_id | string | Reference to corresponding digital-thread entry |

## Sources the Retrieval Agent can query

| Category | Source | What is retrieved | Agent(s) |
|---|---|---|---|
| Product history | PLM (Windchill, Teamcenter) | Similar projects, past specs, versions, archived AMDECs, validation returns | Retrieval, Doc |
| Product history | CAD / PDM | Past geometries, design parameters, reference models | Retrieval, Simulation |
| Product history | Digital Twin | Real in-service behavior, usage conditions, wear data | Retrieval, Simulation |
| Standards & reg. | Internal standards base | EN, ISO, ASME… indexed and versioned | Retrieval |
| Standards & reg. | External standards API | BSI, ISO Online, DIN… version-in-force checks | Retrieval |
| Standards & reg. | Regulations (CE, FDA…) | Regulatory compliance per sector and target market | Retrieval, Doc |
| Supply chain | ERP (purchasing) | Qualified suppliers, available materials, costs, lead times, manufacturing capacity | Retrieval, Generation |
| Supply chain | MES / Sensors | Defect rates, real cycle times, Bs measured in production | Retrieval, Simulation |
| Supply chain | ERP / SAV | Customer complaints, field returns, failure codes, real MTBF | Retrieval |
| Domain knowledge | Patent base | IP, known solutions, free design spaces | Retrieval, Generation |
| Domain knowledge | Scientific literature | Publications, material benchmarks, reference simulation results | Retrieval |
| Domain knowledge | Internal REX base | Technical wiki, engineering notes, formalized lessons learned | Retrieval, Generation |

**AMDEC boundary**: the framework does not compute, store, or display AMDEC. It
reads archived AMDECs from PLM or a dedicated tool (APIS IQ, Relyence…) via the
generic connector, and notifies those tools when new Bs data is available — RPN
computation stays in their system.

## What the user sees in the demo for each connector

| Visual element | Description |
|---|---|
| 'Simulé' / 'Connecté' badge | On every Layer 3 icon — clearly indicates mocked data |
| Visible JSON payload | Every simulated call shows the JSON that would be sent/received |
| Source + timestamp | Every displayed datum shows its simulated source and a coherent fictional timestamp |
| Connector panel (E3) | Horizontal strip, 8 system icons animated when each agent triggers |

Implement as `src/llm/../connectors/simulatedConnector.ts`: a function
`simulateRead(request): ConnectorResponse` returning canned-but-coherent data from
`src/config/connectorFixtures.ts`, plus `simulateWrite(event)` that appends an ADT
entry and animates the strip.
