# A ТЗ by ГОСТ from the living documents

Part of the set's protocol, whose core is `protocol.md`: the same in every
project, and it wins over a project's restatement.
When a customer, a tender or a state contract requires a technical specification
(ТЗ) by Russian standards, it is assembled from the living documents, never kept
beside them.

**A ТЗ is an export, not a second source.** The project's vision, charters,
capability specs, architecture and decision records stay the truth; a ТЗ is
generated from them for the revision it names, in the project's artifact
language or the language the customer requires, and regenerated rather than
edited when they change. A ТЗ that the customer signs and freezes becomes a
contract document: a later change to the requirements it covers is a change
record like any other, and the next export says which version of the ТЗ it
amends (ГОСТ 34.602-2020 puts changes through the same approval as the
original, which the change record's approval already is).

**Which standard.** ГОСТ 34.602-2020 («Техническое задание на создание
автоматизированной системы») for a system that automates an organisation's
activity, which is most commissioned software; ГОСТ 19.201-78 (ЕСПД,
«Техническое задание. Требования к содержанию и оформлению») for a single
program. Ask which one the customer names; do not choose for them. The acceptance
test programme (ПМИ, «Программа и методика испытаний», content by ГОСТ Р
59795-2021, test kinds by ГОСТ Р 59792-2021) is assembled the same way from the
acceptance scenarios.

**Mapping for ГОСТ 34.602-2020.** Every section is present; a section with
nothing to say reads «Не предъявляются», as the standard requires, and never
disappears.

| ТЗ section | Assembled from |
| --- | --- |
| 1. Общие сведения | project name, customer and developer, the charter's dates and basis |
| 2. Цели и назначение создания АС | vision: problem, outcome, success signal |
| 3. Характеристика объектов автоматизации | vision: audience, key journeys, constraints; glossary |
| 4. Требования к АС: структура | architecture: building blocks, deployment |
| 4. функциональные требования | capability specs: requirements and scenarios, by capability |
| 4. требования к видам обеспечения | architecture (software, hardware, information: data model and stores), glossary (linguistic) |
| 4. общетехнические требования | capability specs: quality requirements, gathered by category |
| 5. Состав и содержание работ | roadmap and milestone charters |
| 6. Порядок разработки АС | the project's process: tracked work, reviews, checks |
| 7. Порядок контроля и приёмки | acceptance scenarios and checks; the ПМИ |
| 8. Требования к подготовке объекта | vision constraints; rollout sections of change designs |
| 9. Требования к документированию | the document set this project keeps and what the customer requires |
| 10. Источники разработки | vision, research explorations, decision records |

**What is not taken over.** The staged design packages (эскизный and
технический проект) are not produced unless the contract names them; the
architecture document and decision records hold their content and are exported
into them on request. Formatting to the standard's layout, document codes and
signature sheets are the export's job at the end, not a shape the living
documents take.

**What the standards add that is kept every day:** every quality category is
named in a capability even when nothing is required of it; a requirement is
unique, consistent, feasible, verifiable and unambiguous (the quality criteria
ГОСТ 34.602-2020 lists); acceptance is a programme of checks agreed in advance,
which the acceptance scenarios already are.
