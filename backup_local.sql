--
-- PostgreSQL database dump
--

-- Dumped from database version 12.22 (Ubuntu 12.22-0ubuntu0.20.04.4)
-- Dumped by pg_dump version 12.22 (Ubuntu 12.22-0ubuntu0.20.04.4)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.user_roles DROP CONSTRAINT IF EXISTS user_roles_role_id_fkey;
ALTER TABLE IF EXISTS ONLY public.permissions DROP CONSTRAINT IF EXISTS permissions_role_id_fkey;
ALTER TABLE IF EXISTS ONLY public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;
DROP INDEX IF EXISTS public.permissions_unique_idx;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE IF EXISTS ONLY public.user_roles DROP CONSTRAINT IF EXISTS user_roles_pkey;
ALTER TABLE IF EXISTS ONLY public.roles DROP CONSTRAINT IF EXISTS roles_pkey;
ALTER TABLE IF EXISTS ONLY public.roles DROP CONSTRAINT IF EXISTS roles_name_key;
ALTER TABLE IF EXISTS ONLY public.permissions DROP CONSTRAINT IF EXISTS permissions_pkey;
ALTER TABLE IF EXISTS ONLY public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_pkey;
ALTER TABLE IF EXISTS ONLY public.app_state DROP CONSTRAINT IF EXISTS app_state_pkey;
DROP TABLE IF EXISTS public.users;
DROP TABLE IF EXISTS public.user_roles;
DROP TABLE IF EXISTS public.roles;
DROP TABLE IF EXISTS public.permissions;
DROP TABLE IF EXISTS public.audit_logs;
DROP TABLE IF EXISTS public.app_state;
SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: app_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_state (
    id integer NOT NULL,
    data text NOT NULL,
    CONSTRAINT app_state_id_check CHECK ((id = 1))
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid NOT NULL,
    user_id uuid,
    action text NOT NULL,
    target_type text,
    target_id text,
    details jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permissions (
    id uuid NOT NULL,
    role_id uuid,
    collection_id text,
    item_id text,
    field_id text,
    can_read boolean DEFAULT false,
    can_write boolean DEFAULT false,
    can_delete boolean DEFAULT false,
    can_manage_fields boolean DEFAULT false,
    can_manage_views boolean DEFAULT false,
    can_manage_permissions boolean DEFAULT false
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id uuid NOT NULL,
    name text NOT NULL,
    description text,
    is_system boolean DEFAULT false
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    user_id uuid NOT NULL,
    role_id uuid NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    email text NOT NULL,
    name text,
    provider text,
    provider_id text,
    password_hash text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Data for Name: app_state; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.app_state (id, data) FROM stdin;
1	{"collections":[{"id":"employees","name":"Employés","icon":"Users","color":"#ef4444","properties":[{"id":"name","name":"Nom","type":"text","required":true,"icon":"Type","color":"#8b5cf6"},{"id":"role","name":"Rôle","type":"select","options":[{"value":"Développeur","color":"#3b82f6"},{"value":"Designer","color":"#ec4899"},{"value":"Manager","color":"#f59e0b"},{"value":"Commercial","color":"#22c55e"},{"value":"Rédac","color":"#3b82f6","icon":"Tag"}],"icon":"Briefcase","color":"#ec4899"},{"name":"Sites","type":"relation","icon":"Tag","color":"#8b5cf6","id":"sites_lié","relation":{"targetCollectionId":"sites","type":"many_to_many","targetFieldId":"dev"}}],"items":[{"name":"Yllan","role":"Développeur","sites_lié":["1767782772256","1767796789660","1767885954912","1767910933979"],"id":"1767781553013","undefined":["1767782772256"]},{"name":"Marina","role":"Développeur","id":"1767782261343","sites_lié":["1767782798507","1767796789660"]},{"name":"Sarah","role":"Rédac","id":"1767793665889","sites_lié":["1767796789660","1767782772256"],"undefined":["1767782772256"]},{"id":"new_1767901919205","name":"Furkan","sites_lié":["1767782798507","1767910933979"],"role":"Rédac"},{"id":"new_1767902219706","name":"Sébastien","role":"Rédac","sites_lié":["1767885954912"]}]},{"id":"companies","name":"Entreprises","icon":"Building2","color":"#06b6d4","properties":[{"id":"name","name":"Nom","type":"text","required":true,"icon":"Type","color":"#06b6d4"},{"name":"Sites","type":"relation","icon":"Tag","color":"#8b5cf6","id":"sites_lié","relation":{"targetCollectionId":"sites","type":"many_to_many","targetFieldId":"entreprise"}}],"items":[{"id":"new_1767904305149","name":"ATS COM","sites_lié":["1767782772256","1767910933979"]},{"id":"new_1767904347849","name":"Alsace","sites_lié":["1767782798507"]},{"id":"new_1767904357328","name":"Keck Chauffage","sites_lié":["1767796789660"]},{"id":"new_1767904372106","name":"Meuble Horber","sites_lié":["1767885954912"]}]},{"id":"sites","name":"Sites","icon":"Globe","color":"#eab308","properties":[{"id":"name","name":"Nom","type":"text","required":true,"icon":"Type","color":"#10b981","showContextMenu":true},{"id":"url","name":"URL","type":"url","icon":"Link","color":"#06b6d4"},{"id":"status","name":"Etat","type":"select","options":[{"value":"A traiter","color":"#ef4444","icon":"Tag"},{"value":"En rédac","color":"#3b82f6","icon":"Tag"},{"value":"En dev","color":"#22c55e","icon":"Tag"},{"value":"En Validation","color":"#ef4444","icon":"CreditCard"},{"value":"En Vérif","color":"#8b5cf6","icon":"TrendingDown"},{"value":"A livrer","color":"#eab308","icon":"ShoppingCart"},{"value":"Livré à archiver","color":"#d946ef","icon":"PieChart"},{"value":"Livré et archivé ","color":"#f97316","icon":"MessageSquare"}],"icon":"Flag","color":"#3b82f6"},{"name":"Dev","type":"relation","icon":"Tag","color":"#8b5cf6","relation":{"targetCollectionId":"employees","type":"many_to_many","filter":{"fieldId":"role","value":"Développeur"}},"id":"dev"},{"name":"Temps rédac","type":"date","icon":"Tag","color":"#8b5cf6","defaultDuration":7,"id":"temps_rédac"},{"name":"Temps dev","type":"date","icon":"Tag","color":"#8b5cf6","defaultDuration":14,"id":"temps_dev"},{"name":"Rédac","type":"relation","icon":"Tag","color":"#8b5cf6","relation":{"targetCollectionId":"employees","type":"many_to_many","filter":{"fieldId":"role","value":"Rédac"}},"id":"rédac"},{"name":"Entreprise","type":"relation","icon":"Tag","color":"#8b5cf6","relation":{"targetCollectionId":"companies","type":"many_to_many","targetFieldId":"sites_lié"},"id":"entreprise"},{"name":"Type","type":"multi_select","icon":"Tag","color":"#8b5cf6","options":[{"value":"Starter","color":"#8b5cf6","icon":"Tag"},{"value":"Booster","color":"#3b82f6","icon":"Briefcase"},{"value":"Premium","color":"#f59e0b","icon":"Zap"}],"id":"type"},{"name":"Tâches","type":"relation","icon":"Tag","color":"#8b5cf6","relation":{"targetCollectionId":"a_faire","type":"many_to_many"},"id":"tâches","showContextMenu":true}],"items":[{"name":"Ats com","url":"atscom.com","status":"En rédac","dev":["1767781553013"],"temps_rédac":"2026-01-06T08:00:15.518Z","temps_dev":"2026-01-13T09:04:00.000Z","id":"1767782772256","rédac":["1767793665889"],"temps_dev_duration":10,"entreprise":["new_1767904305149"],"type":"Starter"},{"name":"Alsace debosselage","url":"alsace.com","status":"En dev","dev":["1767782261343"],"temps_rédac":"2026-01-01T08:00:00.000Z","temps_dev":"2026-01-05T08:00:57.191Z","id":"1767782798507","rédac":["new_1767901919205"],"temps_rédac_duration":10,"temps_dev_duration":10,"entreprise":["new_1767904347849"],"type":"Booster"},{"name":"keck chauffage","url":"https://www.keck-chauffage .fr/","status":"Livré et archivé ","dev":["1767782261343"],"rédac":["1767793665889"],"temps_rédac":"2026-01-02T12:00:00.000Z","temps_dev":"2026-01-06T12:00:07.789Z","id":"1767796789660","temps_dev_duration":7,"temps_rédac_duration":8,"entreprise":["new_1767904357328"],"type":["Starter"]},{"name":"Meuble Horber","url":"https://www.meubleshorber.com/","status":"En dev","dev":["1767781553013"],"temps_rédac":"2026-01-07T08:00:00.000Z","temps_rédac_duration":14,"temps_dev":"2026-01-07T12:00:57.191Z","rédac":["new_1767902219706"],"id":"1767885954912","entreprise":["new_1767904372106"],"type":"Premium"},{"name":"test","id":"1767910933979","type":"Starter","entreprise":["new_1767904305149"],"status":"A traiter","url":"atscomRefonte.com","rédac":["new_1767901919205"],"temps_rédac":"2026-01-21T08:00:00.000Z","dev":["1767781553013"],"temps_dev":"2026-01-26T08:00:00.000Z","tâches":["1767911662090","1767913263301"]}]},{"id":"a_faire","name":"Tâches","icon":"FileText","color":"#ef4444","properties":[{"id":"name","name":"Nom","type":"text","required":true},{"name":"Type","type":"multi_select","icon":"Tag","color":"#8b5cf6","options":[{"value":"A traiter","color":"#ef4444","icon":"Tag"},{"value":"Faite","color":"#22c55e","icon":"Bookmark"}],"id":"type","showContextMenu":false},{"name":"Sites","type":"relation","icon":"Tag","color":"#8b5cf6","id":"sites_lié","relation":{"targetCollectionId":"sites","type":"many_to_many","targetFieldId":"tâches"}}],"items":[{"name":"Possibilité de mettre en clic droit (contextual) certaines proprietés pour un objet","type":["Faite"],"id":"1767911662090","sites_lié":["1767910933979"]},{"sites_lié":["1767910933979"],"name":"Corriger le menu contextuel","type":["A traiter"],"id":"1767913263301"}]}],"views":{"employees":[{"id":"default","name":"Toutes les données","type":"table","filters":[],"groups":[],"hiddenFields":[]}],"companies":[{"id":"default","name":"Toutes les données","type":"table","filters":[],"groups":[],"hiddenFields":[]}],"sites":[{"id":"default","name":"Toutes les données","type":"table","filters":[{"property":"status","operator":"not_equals","value":"Livré et archivé "}],"groups":["status"],"hiddenFields":[],"fieldOrder":["entreprise","name","url","status","rédac","temps_rédac","dev","temps_dev"]},{"id":"1767777559444","name":"Etat kanban","type":"kanban","filters":[{"property":"status","operator":"not_equals","value":"Livré et archivé "}],"groups":[],"hiddenFields":["status","temps_rédac","temps_dev","url","name"],"groupBy":"status","fieldOrder":["name","entreprise","url","status","dev","temps_rédac","temps_dev","rédac","type"]},{"id":"1767777570003","name":"Calendrier Dev","type":"calendar","filters":[],"groups":[],"hiddenFields":["status"],"dateProperty":"temps_dev"},{"id":"1767887090420","name":"Archivés","type":"table","filters":[{"property":"status","operator":"equals","value":"Livré et archivé "}],"groups":[],"hiddenFields":["name"],"fieldOrder":["name","entreprise","type","url","status","rédac","temps_rédac","dev","temps_dev"]},{"id":"1767906660169","name":"Calendrier Yllan","type":"calendar","filters":[{"property":"dev","operator":"equals","value":["1767781553013"]}],"groups":[],"hiddenFields":["name"],"dateProperty":"temps_dev","fieldOrder":["entreprise","name","url","status","dev","temps_rédac","temps_dev","rédac","type"]}],"a_faire":[{"id":"default","name":"Toutes les données","type":"table","filters":[],"groups":[],"hiddenFields":[]}]},"activeCollection":"sites","activeView":"default"}
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.audit_logs (id, user_id, action, target_type, target_id, details, created_at) FROM stdin;
b3ea6636-d16f-45bb-af52-9876012df268	694e5070-1877-42b9-9268-650ff19a63c9	state.save	app_state	1	{"collections": 0}	2026-01-08 10:21:06.594786+01
d2f13bd1-6046-4ff2-b23a-314cf9ee81e2	694e5070-1877-42b9-9268-650ff19a63c9	state.save	app_state	1	{"collections": 3}	2026-01-08 10:21:06.635684+01
3dd5e722-4ee6-4dab-8a29-8b5ebc76abc3	694e5070-1877-42b9-9268-650ff19a63c9	state.save	app_state	1	{"collections": 0}	2026-01-08 10:22:09.649294+01
36350389-4a57-483b-a5c7-88b2edad9eca	694e5070-1877-42b9-9268-650ff19a63c9	state.save	app_state	1	{"collections": 3}	2026-01-08 10:22:09.663185+01
90494948-2d9a-4208-9905-63880416024a	694e5070-1877-42b9-9268-650ff19a63c9	user_roles.add	user	cedba177-5aa6-4d81-82d6-f09aecb47dfe	{"roleId": "133acd06-d1e0-4be0-813f-52e29263b1ee"}	2026-01-08 10:22:21.093189+01
adbc74f7-11f6-4967-91d0-099868ebe96f	694e5070-1877-42b9-9268-650ff19a63c9	state.save	app_state	1	{"collections": 3}	2026-01-08 10:22:30.024357+01
c049504c-6f7d-434c-915e-7ecb56c4e0d1	694e5070-1877-42b9-9268-650ff19a63c9	state.save	app_state	1	{"collections": 3}	2026-01-08 10:22:30.119544+01
e4f784e2-2bac-45dd-b041-d61fe47082f2	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 0}	2026-01-08 10:22:35.497669+01
172a56a5-ae19-4d72-a39a-8e0ab0cad288	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 10:22:35.522332+01
b3a68f09-7a8d-4775-ad6b-14b88b06dd34	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 10:22:37.188472+01
7643b24e-deea-4784-8d76-b73d785b0273	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 10:22:37.978582+01
a8cfb7fd-f820-4cc8-9b59-acb5f8540b6b	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 10:22:39.006876+01
ffc41fae-8f25-4fb6-82d3-e3180da132a5	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 10:22:39.331426+01
9354e7d4-603c-403a-b7bc-76441f3b26bb	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 10:22:40.621054+01
8ed7b3f0-ff22-4563-b6c4-b3b2e09ddd62	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 10:22:41.203731+01
95647dd1-c46e-4c2d-aa0e-4acd908bd4a6	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": false, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 10:23:40.473453+01
337fb336-bed3-472a-81d9-22197791897b	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": false, "field_id": null, "can_write": false, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 10:23:42.417119+01
e553d893-4ffc-4512-9064-69e8bbe6dad2	cedba177-5aa6-4d81-82d6-f09aecb47dfe	user_roles.remove	user	cedba177-5aa6-4d81-82d6-f09aecb47dfe	{"roleId": "133acd06-d1e0-4be0-813f-52e29263b1ee"}	2026-01-08 10:24:00.107785+01
3f579169-e5dd-4768-8ad7-93726d61dd46	694e5070-1877-42b9-9268-650ff19a63c9	state.save	app_state	1	{"collections": 0}	2026-01-08 10:26:46.352632+01
6770b960-bff9-4818-b2f7-0d6dd5695026	694e5070-1877-42b9-9268-650ff19a63c9	state.save	app_state	1	{"collections": 3}	2026-01-08 10:26:46.401151+01
d5aac2bd-92dc-403b-808a-81aa0def623b	694e5070-1877-42b9-9268-650ff19a63c9	user_roles.add	user	cedba177-5aa6-4d81-82d6-f09aecb47dfe	{"roleId": "133acd06-d1e0-4be0-813f-52e29263b1ee"}	2026-01-08 10:26:56.149832+01
fe61ee34-a940-4d02-9f03-3a6efa5342e6	694e5070-1877-42b9-9268-650ff19a63c9	state.save	app_state	1	{"collections": 3}	2026-01-08 10:28:46.148692+01
250bc645-ca1f-4777-990a-3a6d902418be	694e5070-1877-42b9-9268-650ff19a63c9	state.save	app_state	1	{"collections": 3}	2026-01-08 10:28:46.172317+01
d1c6931e-26bb-4d8d-b2fd-527bd6e38937	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 0}	2026-01-08 10:29:21.415698+01
36cd366c-091e-4c81-ae30-67bc64c78088	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 10:29:21.440245+01
2c7bb51a-19c1-45c5-99c3-335215b86fb4	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 10:29:47.991344+01
0bffa735-3718-4e31-a5c7-1d97c90e6fb9	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 10:29:48.015736+01
92feb5fb-e65e-4662-8e2d-7b1cede4521c	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 0}	2026-01-08 10:30:07.100423+01
3c81f615-fc3e-45cd-9bec-3594c2fd4c69	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 10:30:07.132944+01
bd58659a-9d15-46d2-b5e1-9fb9b61e7eac	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 0}	2026-01-08 10:30:58.024727+01
96875180-26b9-4162-a826-d501dbfcb441	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 10:30:58.066017+01
9e78887c-f164-4a83-9b5b-94f69b3205e1	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": true, "field_id": null, "can_write": false, "can_delete": false, "collection_id": null, "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 10:31:10.089929+01
d2df6cd7-109f-48fc-891b-1c176ca96974	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": true, "field_id": null, "can_write": false, "can_delete": false, "collection_id": null, "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 10:31:12.280892+01
2467b2f7-f9a0-461d-8ac6-92d5a5c9e48a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 10:31:20.565357+01
75c0e656-3937-4c77-b7ed-4b6ac5879809	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 10:31:20.588975+01
0abbd0a0-081b-4c35-902a-34bea2560e43	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 10:32:01.223458+01
491e6de6-c98d-43e0-81fe-59c128b2d0f9	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 10:32:01.236189+01
57244610-d0e5-4692-bbf5-b90279d72a9c	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 10:32:02.014234+01
521b5873-4ccc-4f81-a97a-d6d55e2dd6ed	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 10:32:02.025857+01
2c8b1047-7b2c-4623-b372-035334bd9b2b	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 0}	2026-01-08 10:32:40.949616+01
0a4552ce-1a4d-4a3c-ac53-f5a55fcb405f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 10:32:40.981528+01
263952f4-1d94-46ec-9ce2-85ec7f31a4b2	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": true, "field_id": null, "can_write": false, "can_delete": false, "collection_id": null, "can_manage_views": false, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 10:32:52.476447+01
38e25e5c-10f1-4eb9-aec6-e99a4795a308	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": true, "field_id": null, "can_write": false, "can_delete": false, "collection_id": null, "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 10:32:53.109374+01
91120ace-e8d9-4a6b-8447-322be6ad7de0	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": true, "field_id": null, "can_write": false, "can_delete": false, "collection_id": null, "can_manage_views": false, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 10:32:58.559578+01
98226bc9-50cd-4ad9-bf25-6697cf4c7883	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": true, "field_id": null, "can_write": false, "can_delete": false, "collection_id": null, "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 10:32:58.992591+01
49032c14-9dd6-4134-85bc-9fbbbdbe1560	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 10:33:02.659582+01
21354369-4a63-401f-868e-876d42384c6f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 10:33:02.680018+01
5226b096-7995-4080-af63-5fe29972ba9b	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 10:36:20.587782+01
247b51f0-0415-4b88-92ec-e7632cd63247	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 10:36:20.62408+01
7748f228-bc9e-48e0-a529-8c0c81ade2cf	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 10:36:20.656803+01
e88a5eea-086b-41f0-bbe5-c7fe69c031c7	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 10:36:21.537201+01
482c6d74-5ce0-4348-9ad9-cd1fa3a2125e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 10:36:21.561639+01
fcbade04-e58a-4f1b-94a9-0ada5a6e037d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 10:36:21.586024+01
be530927-4f4a-472a-a6c5-89f589e95ccc	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 10:36:21.597799+01
37835aeb-71ce-4f30-930b-c0dc00b30398	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 0}	2026-01-08 11:07:05.132579+01
0b52dc4f-123c-4e35-af00-a26456b1c85d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:07:05.164606+01
0cf2c4df-dda3-43d8-bb34-60f89f1448a8	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:07:10.526515+01
91e70ad6-7e39-4986-ac5d-a1a2abd893ee	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:07:11.942672+01
3b3e4c8e-20fe-481d-8e99-32a1e77947ea	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:07:13.178579+01
4ab1b994-68bb-46bc-9524-15148a10b581	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:07:15.031873+01
60d295dd-5282-43a2-b659-f1cbc24e2015	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:07:15.480963+01
d9933f14-0b29-43f0-b462-fb4703a77277	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:07:17.570073+01
490a91b3-5b79-42c2-894c-b4f8b9559be1	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:07:18.128028+01
c0db49fa-6f29-4cf0-9290-0424dc06514a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:07:19.177461+01
0da904ac-c25c-447d-b654-70414d81f926	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": false, "field_id": null, "can_write": false, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:07:25.252607+01
5be090d4-da43-4634-b717-5fcc4863e156	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": false, "field_id": null, "can_write": false, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:07:28.794959+01
3eb91a91-33d4-4b2f-9bdd-21bc81c42481	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": false, "field_id": null, "can_write": true, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:07:38.965833+01
c04b3961-0545-47ef-a0fd-97e75621f33d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": false, "field_id": null, "can_write": false, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:07:40.698538+01
2426e03a-9779-4ee4-8b29-c4a423f86637	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:07:48.333671+01
9ad8560d-6c6e-4dc8-931b-03b4063d38dd	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:07:48.374672+01
7bd5b343-84aa-496f-bdd2-ddd8c36378be	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": false, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:12:21.964344+01
6b4e1587-b84d-461a-805c-4492cc97a0c4	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": false, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:12:25.845771+01
9007af17-792e-4a0e-b73d-9a5772d707df	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": false, "field_id": null, "can_write": false, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:12:29.008319+01
41c022dc-fc19-4a22-9291-4396f7bc241b	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:14:14.050597+01
49d1dd06-b7b8-4d56-9bd1-d48cc24f5ef9	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:14:14.075821+01
450c77e1-8197-456e-ba78-f1c386bbadf1	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": false, "field_id": null, "can_write": false, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:14:17.183911+01
cdbcfab1-56b5-4edd-9044-3da7d85c1df5	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": false, "field_id": null, "can_write": false, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:14:21.534966+01
a89aab43-aed9-4d53-9c79-310e71cc7990	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": true, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:14:25.405875+01
3f916fc6-f332-48e3-8fcd-faade860fefd	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:15:00.682268+01
c3085758-9605-42cf-bdf3-1305276f2181	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:15:00.706726+01
6e2f1aad-fc31-4011-b8da-8c9d0d9a6dbd	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": true, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:15:03.680775+01
d0460671-eb6a-496d-851e-92f6cb36632f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:15:04.805182+01
20c2e5b2-5f17-41f8-8bbc-f7bcbe7361ef	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:15:04.83701+01
e696942c-218b-4259-aaab-c16e9a0c11e8	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": true, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:15:38.443454+01
d0917fd0-2277-4f82-a9fe-7475994eeb67	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": true, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:15:57.585671+01
34b54171-5e2e-4657-9dd1-542d7a98cb26	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": true, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:16:03.207041+01
e5461a4c-41e9-4bec-be0f-8688e921f4c8	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": false, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:16:04.059464+01
ff31b2f7-a66e-4554-9e58-bce8d896bac9	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": true, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:16:04.69218+01
c19f6525-3721-48f0-88c8-b3f3964ade8c	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:16:08.86675+01
33e25031-1123-4de3-92e4-ab4e67e61a56	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:16:08.879405+01
baa53192-d2cd-419c-a4e9-faa6894dd54d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": true, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:16:13.898807+01
485c5005-0563-439c-a4c1-a8f1d3c0ef5c	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:16:17.616636+01
b64a7564-eace-4708-92ce-08818cdfac1b	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:16:17.627046+01
fe0758da-7793-473e-8a2b-c0c3a92db472	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": true, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:17:33.590355+01
c4169d8a-477b-4823-acc5-8e7a624bce62	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:17:36.703294+01
ee02596f-8a82-4aad-8ee1-d8d3ea0b7cf1	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:17:36.735953+01
a932a04b-6121-4316-b893-5fea87b8f662	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": true, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:17:39.492339+01
30c5316d-d93f-405a-813a-a98e25e4babe	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:18:22.812073+01
ed53f8e1-0067-49f8-94d4-1150c8a4d1b7	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:18:22.845241+01
ab317492-8a41-4f80-8f96-6391fee7a819	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:18:27.613814+01
76cdb875-9359-4609-95a8-6821d564639a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:18:29.813634+01
dabce2e2-ba4e-45e2-86e4-89235573e878	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:18:35.699205+01
6c2c2cf9-a401-48f7-b93b-dfae4fdf0e98	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:18:35.712682+01
6d134fdf-d4b5-4272-a2f7-6090f91ecdba	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": false, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:18:39.450194+01
bf5c40b4-6af3-4ceb-b823-f72b886f914e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:18:41.944091+01
489ee8a4-812a-4725-84e4-0a078c5c6878	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:18:41.955752+01
a16a957d-4cd3-47b6-845f-3337971da28f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:22:25.2941+01
07d90706-86ae-466a-8fa9-ed97c5317816	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:22:25.318859+01
e7d1463d-14b8-4064-a177-a2e6a61d56f9	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:22:42.890106+01
0786cf57-e3e7-48d9-8421-5a0219222eb9	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:22:43.20922+01
43113960-4b41-4a04-96fa-3bd80fbac61e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": false, "can_delete": false, "collection_id": "companies", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:23:00.68574+01
5234ce73-868d-4eec-8be5-91bfdd6e3d96	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": true, "can_delete": false, "collection_id": "companies", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:23:01.786952+01
ab852cbf-e850-4b5b-b329-b2d46ba8880a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": true, "can_delete": true, "collection_id": "companies", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:23:02.593919+01
92f8cfa2-914f-4eaf-9e2d-463d0524667e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": true, "can_delete": true, "collection_id": "companies", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": true}	2026-01-08 11:23:03.367875+01
19ce1e98-4b53-41f6-bc56-ed634ce704af	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": true, "can_delete": true, "collection_id": "companies", "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": true}	2026-01-08 11:23:04.700761+01
92eea639-8fd0-4515-9e0f-440bdc890d82	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": true, "can_delete": true, "collection_id": "companies", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": true}	2026-01-08 11:23:05.466839+01
8c9c3e00-d0ec-4358-a4ea-84db623edf0d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": false, "field_id": null, "can_write": true, "can_delete": true, "collection_id": null, "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": true}	2026-01-08 11:23:06.566286+01
c7faba4f-f1fd-4f5a-b60a-0151e5a4e31a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": true, "can_delete": true, "collection_id": null, "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": true}	2026-01-08 11:23:10.493263+01
d2e23b3b-cfbb-4c6f-bae9-0869b241718b	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:43:50.064284+01
3ba0eb86-4b59-402c-b56f-a612f834ffb7	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": false, "field_id": null, "can_write": true, "can_delete": true, "collection_id": "companies", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": true}	2026-01-08 11:23:12.567224+01
ce312273-4b84-4709-9f4a-da521c0a3e30	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": false, "field_id": null, "can_write": false, "can_delete": true, "collection_id": "companies", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": true}	2026-01-08 11:23:13.22939+01
33230d00-abc7-4273-a554-004275e073c6	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": false, "field_id": null, "can_write": false, "can_delete": true, "collection_id": "companies", "can_manage_views": false, "can_manage_fields": true, "can_manage_permissions": true}	2026-01-08 11:23:13.603906+01
06d85ed0-c5aa-419b-b681-b79b4741b485	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": false, "field_id": null, "can_write": false, "can_delete": true, "collection_id": "companies", "can_manage_views": false, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:23:14.151089+01
fd918fa8-eab4-4e5f-9ced-90e7542189a9	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": false, "field_id": null, "can_write": false, "can_delete": false, "collection_id": "companies", "can_manage_views": false, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:23:14.483834+01
acbda540-4ffb-4095-b155-26384cc3db78	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": false, "field_id": null, "can_write": false, "can_delete": false, "collection_id": "companies", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:23:15.207593+01
aaa393d5-cda1-4f47-9451-a09976743dc0	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": true, "field_id": "name", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:23:36.210962+01
533b5f96-3ec9-4499-a0ef-834869c01c46	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": true, "field_id": "url", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:23:37.190003+01
32a21441-1d73-4f5b-aac7-bb5d0f8d79cd	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": true, "field_id": "dev", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:23:39.530498+01
cbcdc4e9-88f1-43ab-be78-eb73da6e1017	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": true, "field_id": "temps_rédac", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:23:40.030377+01
5a9d9a79-4b64-4bb0-8ea4-d375b81d0597	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": true, "field_id": "temps_dev", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:23:41.887745+01
2fe55497-4e80-4210-aed8-66ed08a9b071	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": true, "field_id": "rédac", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:23:43.133504+01
618ee531-7c6d-43e5-84ea-e4c4527a7527	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": false, "field_id": "rédac", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:23:46.177741+01
773461e5-216b-4c0a-a640-b4ad5fbed730	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 0}	2026-01-08 11:24:21.993958+01
a8cacb31-cd0b-4585-b72c-e852d075b3d1	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:24:22.109289+01
388e57ee-d6b1-4020-ad85-c725374777f5	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:29:22.634052+01
df892586-9569-490f-8722-9d39f3557854	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:29:22.650194+01
1c98911d-eea6-423d-bde5-0b9afcc500cd	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": false, "field_id": null, "can_write": true, "can_delete": true, "collection_id": null, "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": true}	2026-01-08 11:29:25.433247+01
7365f73c-37a4-40a3-9618-2789e6c55fa1	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": false, "field_id": null, "can_write": false, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:25.457163+01
e8ae023d-837d-45e0-b2dc-102224db56a1	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": false, "field_id": "name", "can_write": false, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:25.490562+01
c079500f-6326-4c1b-aad0-6a6a28b8147a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": false, "field_id": "role", "can_write": false, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:25.522185+01
41eda410-454d-4854-9d36-b97d5133c6e5	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": false, "field_id": "sites_lié", "can_write": false, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:25.554985+01
498a312a-6e20-4f13-a36b-ea593e014590	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": false, "field_id": null, "can_write": false, "can_delete": false, "collection_id": "companies", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:25.587688+01
6e3c2c4d-f8a3-4e30-aae1-6ec9639831ba	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 0}	2026-01-08 11:43:55.330352+01
ad19f722-4e64-4733-b0e2-0d7658c0c64b	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:43:57.052738+01
c9d6f991-ba99-4d1b-bd3b-22441cfbb87e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": false, "field_id": "name", "can_write": false, "can_delete": false, "collection_id": "companies", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:25.621003+01
c776abf5-0420-4725-ba7c-beff0bd002d4	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": false, "field_id": null, "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:25.653426+01
39902423-a5f6-4606-90e0-a70fa0b50c08	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": false, "field_id": "name", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:25.686294+01
7fa1ef63-e0ae-4ec1-92b1-8c04217c9bb9	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": false, "field_id": "url", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:25.718226+01
1b644791-7580-4e7a-8359-8ad2a33ada8a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": false, "field_id": "status", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:25.751083+01
4814ebce-6a36-4aea-9c4b-7863f839e768	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": false, "field_id": "dev", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:25.784087+01
38f41874-443c-4238-ae01-75c13c212c44	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": false, "field_id": "temps_rédac", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:25.816678+01
3b587353-0908-4eec-936d-46c235877655	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": false, "field_id": "temps_dev", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:25.849565+01
44d87448-edd2-4a6c-af3f-f84e94e2d038	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": false, "field_id": "rédac", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:25.881394+01
c9d49a7f-2d1e-4ad1-a829-097b6a26477b	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": true, "can_delete": true, "collection_id": null, "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": true}	2026-01-08 11:29:26.790906+01
99f42de0-cf2a-4a3f-b5aa-2fef0c1b3454	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": false, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:26.823726+01
fb9fed46-e020-4a92-9810-b99b7648e536	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "name", "can_write": false, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:26.856634+01
bf5fa987-45e2-4fc8-ac61-b8a934085619	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "role", "can_write": false, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:26.888606+01
f3a2f4e5-fa4d-4e5a-9dcd-0cac775aa4b8	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "sites_lié", "can_write": false, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:26.921328+01
5d39d6ca-6591-4934-b758-504f76e28a22	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": false, "can_delete": false, "collection_id": "companies", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:26.954233+01
e2287983-a674-45a0-9de0-04d1f9babca3	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "name", "can_write": false, "can_delete": false, "collection_id": "companies", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:26.987103+01
67837794-257b-4406-b691-544fc3d31879	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:27.019823+01
2f86dace-1d9f-479b-b52b-de05e012d98f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "name", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:27.052774+01
ee02c9a9-81c9-4e79-bd34-27f717fc97cc	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "url", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:27.084623+01
607678b6-28fd-4a2b-82bf-d01b872a2289	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "status", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:27.117508+01
b13942b0-c64f-4023-8094-e098c3bd0513	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:43:55.354833+01
aa219070-7539-47a5-b7ad-7ce5ba00c285	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:43:57.077425+01
a3383959-e6c8-4029-afcc-f39354b5552a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "dev", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:27.150388+01
f5ae788d-ff2e-46a9-853e-ffeba6f8b7b2	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "temps_rédac", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:27.183633+01
68bdee7b-bf77-4fd6-9e75-a127b6ed361c	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "temps_dev", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:27.216017+01
6de55a03-56dd-4f16-9574-a6828fb6c217	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "rédac", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:27.248078+01
1b4f9bcd-0d9c-46be-84be-e8a2ac0894f3	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": false, "field_id": null, "can_write": true, "can_delete": true, "collection_id": null, "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:34.139725+01
090b3ff5-69d2-4224-b506-9a319dc4d7a2	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": false, "field_id": null, "can_write": true, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:34.187691+01
834b86eb-a8ac-4b50-b85f-41d3a70d3572	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": false, "field_id": "name", "can_write": false, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:34.235632+01
e0c6bc48-f7f0-480d-93b7-05e2e8571243	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": false, "field_id": "role", "can_write": false, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:34.267823+01
02b8e4ab-3c16-43d3-9160-5d7b6f562a54	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": false, "field_id": "sites_lié", "can_write": false, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:34.300629+01
22f4d478-a1ca-49a0-8c39-82cebd977eeb	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": false, "field_id": null, "can_write": false, "can_delete": false, "collection_id": "companies", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:34.333652+01
a8c1005f-57a4-4dcc-9e14-5c81c62fddd4	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": false, "field_id": "name", "can_write": false, "can_delete": false, "collection_id": "companies", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:34.36633+01
da8b4093-a321-42c1-9e0b-0eceb7c5427a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": false, "field_id": null, "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:34.398138+01
9e985ace-7244-42b8-9a19-f5212b894f4e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": false, "field_id": "name", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:34.431061+01
2165a885-90f8-4f47-afe5-8529e1e6d98f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": false, "field_id": "url", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:34.464098+01
58b287dd-799a-48c9-845d-2674e3cf6598	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": false, "field_id": "status", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:34.513281+01
64e5043c-24af-416f-ad56-8467b3d8b2fd	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": false, "field_id": "dev", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:34.54623+01
2e5eff1a-f3a4-4a96-8355-c2a280701a00	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": false, "field_id": "temps_rédac", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:34.578088+01
a9518c8c-6171-4c1b-bc27-14097e65bf56	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": false, "field_id": "temps_dev", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:34.611133+01
9565aa4e-5c37-4b5f-b35f-3b28414e72a8	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": false, "field_id": "rédac", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:34.644053+01
c2f60c3e-624e-4e79-9426-3a821661a91d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": null, "can_write": true, "can_delete": true, "collection_id": null, "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:35.209943+01
ac5c534e-d608-43f8-ab6a-8b02bbd961b1	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:44:05.198972+01
b795e2fa-bd9f-4432-ad43-296b3850f4e2	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:52:41.762289+01
e62540b7-8789-4f99-9f09-ea32feafd2ac	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": null, "can_write": true, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:35.242946+01
9d125a2d-e727-4404-96b6-891a979bffa4	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "name", "can_write": false, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:35.275816+01
82934129-fd5d-4ece-8f9f-fbdb011e3371	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "role", "can_write": false, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:35.307609+01
3a65048d-64a4-4d5e-abc5-cd900ce4ade3	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "sites_lié", "can_write": false, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:35.340549+01
f20b6eb8-601e-4faa-bf0a-942fe1803392	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": null, "can_write": false, "can_delete": false, "collection_id": "companies", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:35.373395+01
b9ce83a4-2046-4109-a667-efc8690dc606	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "name", "can_write": false, "can_delete": false, "collection_id": "companies", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:35.406097+01
b801c6d1-8e43-4722-ada5-097889e23019	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": null, "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:35.438872+01
d3a06833-acbc-499a-b439-e1583a1d0cef	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "name", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:35.470812+01
8bfb4e24-2d4f-4a4e-9496-584bea238d52	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "url", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:35.503716+01
ae9ddcf9-1a71-404d-ab55-ead058b475b4	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "status", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:35.536615+01
406311b6-b25b-4c82-b217-b5804956a88a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "dev", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:35.569386+01
804ecf36-0812-4cbb-8fae-f8b5ba9a84d9	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "temps_rédac", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:35.602175+01
beb36b57-8811-41b8-a34f-ec3afef89537	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "temps_dev", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:35.635042+01
fc60b2d8-bd61-4590-9d3f-91466f92b257	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "rédac", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:35.667117+01
b4633da8-cf3f-432a-9a23-8d7d7c760ea1	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": null, "can_write": false, "can_delete": true, "collection_id": null, "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:37.091589+01
a3e04149-6b2f-452d-a05d-ca8ac84e0dee	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": null, "can_write": false, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:37.124328+01
30006328-7bc6-468a-98b6-328a86f289f9	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "name", "can_write": false, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:37.215433+01
00fb6437-57ee-46c7-8215-be9fcb4feedc	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "role", "can_write": false, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:37.248329+01
2e871d6a-0c05-4d4e-829f-6e534de10ed1	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "sites_lié", "can_write": false, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:37.281252+01
d29d0375-b9cb-441e-8ee9-67ef6a17354d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": null, "can_write": false, "can_delete": false, "collection_id": "companies", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:37.313032+01
88125ab6-872b-48e0-af98-e7a3b78a16c1	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:44:05.278252+01
ced08986-9b70-4317-a5ea-1d3cb7485161	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:52:51.510447+01
60240422-fb71-47df-a89b-645c8cebdadb	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "name", "can_write": false, "can_delete": false, "collection_id": "companies", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:37.345949+01
e848e03b-c1fb-400b-9c3c-a2523f77ea68	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": null, "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:37.378798+01
819b20c3-fc2f-468f-bb7f-315b3304e3d0	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "name", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:37.411611+01
00cb9121-f559-43f9-93d3-180fa89a16bf	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "url", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:37.444421+01
2d9bb0d9-4a0d-46e7-8703-6db37cb98761	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "status", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:37.476292+01
0b8993ee-f3eb-483a-81e4-f4c93b45697f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "dev", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:37.521884+01
47a4e453-7d20-4d1b-8626-4353c95aaa7c	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "temps_rédac", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:37.554737+01
b11d943c-0b4f-421c-9dfd-965645b92856	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "temps_dev", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:37.586751+01
6c39fca1-60be-421b-9aee-9ff391ab54d2	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "rédac", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:37.880731+01
0d36dce3-46f6-4394-a7ba-ab4c362a4b99	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": null, "can_write": true, "can_delete": true, "collection_id": null, "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:38.410864+01
a70fb761-30ea-4d6c-b513-db22e9bccc3d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": null, "can_write": true, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:38.435148+01
3df1ecdc-46e5-462d-aa11-20de273957a6	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "name", "can_write": true, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:38.46824+01
723d2e7b-58d7-428d-9efb-c2796194f085	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "role", "can_write": true, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:38.500161+01
e3f11f3a-ca92-4240-8476-5a6c490ccd7d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "sites_lié", "can_write": true, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:38.524392+01
ca8a8506-77e2-4640-84a8-ba6add5ea5d1	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": null, "can_write": true, "can_delete": false, "collection_id": "companies", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:38.557302+01
23abe5e5-9d33-479a-993a-74f7ac129623	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "name", "can_write": true, "can_delete": false, "collection_id": "companies", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:38.590188+01
9f82928c-677a-4fb1-8dfa-dd5500c335f0	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": null, "can_write": true, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:38.623209+01
415a1e0c-e0b9-46a5-9bb6-8e98423d2ef9	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "name", "can_write": true, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:38.64757+01
e4ec265b-d79e-4c38-a8eb-7ad4beb697b5	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "url", "can_write": true, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:38.69638+01
95888d8e-b569-4077-a4a4-c4054a2f8364	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "status", "can_write": true, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:38.745451+01
eb124169-ec0b-463c-91e9-ff08994326b8	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:45:53.219026+01
4c91f543-d713-41f1-96f0-b2dd701edd13	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:52:57.268561+01
0eeee545-b8aa-4e5c-b8be-d344bcd15a54	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "dev", "can_write": true, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:38.777573+01
55eef9ea-6ecd-4fe0-9388-deabe0172bdd	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "temps_rédac", "can_write": true, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:38.809418+01
2b84f87a-92e2-4892-b692-6f2a4c0553a5	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "temps_dev", "can_write": true, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:38.833914+01
b86bb666-f022-43d0-99d4-d68cc126474d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "rédac", "can_write": true, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:38.866851+01
88d16768-8a01-4f93-84eb-1d3ad65098bf	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": null, "can_write": true, "can_delete": true, "collection_id": null, "can_manage_views": false, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:41.040687+01
9845fd40-3e8e-4879-ae7d-43cce3937bb4	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": null, "can_write": true, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:41.074245+01
d0d0208b-9a32-41e0-ad0a-33d294d449e3	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "name", "can_write": true, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:41.105548+01
d6ec4056-d5d7-4d45-8d94-a1670ab6e662	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "role", "can_write": true, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:41.138338+01
f9f216b6-57a7-4e79-86da-4d81a74ae21d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "sites_lié", "can_write": true, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:41.171222+01
3b4af3f4-1c5b-4060-9756-f0e475982eec	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": null, "can_write": true, "can_delete": false, "collection_id": "companies", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:41.204272+01
02432c14-7194-4d64-a02d-edfa16113f0e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "name", "can_write": true, "can_delete": false, "collection_id": "companies", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:41.228594+01
bc462d4e-55f7-4119-a412-cc0cda2ed98b	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": null, "can_write": true, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:41.26142+01
64e321f6-48f8-4484-9451-0b3b77a33e56	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "name", "can_write": true, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:41.293268+01
9c07d03f-80a6-4e70-ad25-4c305f3c5481	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "url", "can_write": true, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:41.326183+01
87801611-d316-4969-bda3-2ee51b5d66f1	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "status", "can_write": true, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:41.350606+01
2705096f-de70-45c6-9b42-d8114c40d76d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "dev", "can_write": true, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:41.383667+01
b03f8a46-07ef-41c0-8a9d-206e7a5532e9	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "temps_rédac", "can_write": true, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:41.416387+01
1a462c6d-a88a-447d-8dc7-67dc1615e16b	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "temps_dev", "can_write": true, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:41.4482+01
3c890aea-2e73-42a0-b4e5-829e095f50d0	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "rédac", "can_write": true, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:41.4811+01
b52b48f2-e4eb-412c-a620-1b8b64112edf	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": null, "can_write": true, "can_delete": true, "collection_id": null, "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:41.897314+01
05110029-3624-4e68-96b1-ca0e98fd74ff	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:45:53.243233+01
fec9b2b3-9b17-4475-8d4f-ead1cc9f280e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:53:05.383775+01
3aeb83bd-9002-4936-a184-e336a25f6e20	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": null, "can_write": true, "can_delete": false, "collection_id": "employees", "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:41.930208+01
34392176-bb6a-44ff-9c76-a228f081d095	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "name", "can_write": true, "can_delete": false, "collection_id": "employees", "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:41.954525+01
4b843219-9c07-4689-8783-f10b0c907148	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "role", "can_write": true, "can_delete": false, "collection_id": "employees", "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:41.987498+01
62dd561a-1f8a-45ac-a8d8-0725c3dfecac	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "sites_lié", "can_write": true, "can_delete": false, "collection_id": "employees", "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:42.019341+01
d8819794-0f8a-4be7-8f00-09a35bb1315a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": null, "can_write": true, "can_delete": false, "collection_id": "companies", "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:42.052333+01
6f97045b-cad7-49da-b907-f34df267ba7b	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "name", "can_write": true, "can_delete": false, "collection_id": "companies", "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:42.076678+01
0e6f5045-909b-4c9a-83b8-1f218611ac89	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": null, "can_write": true, "can_delete": false, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:42.109738+01
5b866b47-f4a8-4228-88b7-f1804cfe3a4d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "name", "can_write": true, "can_delete": false, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:42.142548+01
1e582666-622e-4469-b0d4-16d04a19fccd	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "url", "can_write": true, "can_delete": false, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:42.174255+01
b7da6c49-f998-441a-8487-0d5baa56f227	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "status", "can_write": true, "can_delete": false, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:42.207106+01
fb17f886-2cab-47e3-8f0e-e12c0585e18b	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "dev", "can_write": true, "can_delete": false, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:42.245119+01
b0be8a7c-a7fd-4be3-a7bc-da595a491c0e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "temps_rédac", "can_write": true, "can_delete": false, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:42.276275+01
d0143b97-eeb3-4af8-b97b-65ff2d5abfd4	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "temps_dev", "can_write": true, "can_delete": false, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:42.309294+01
f4708121-df30-40f4-a002-84dacb66f6f1	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "rédac", "can_write": true, "can_delete": false, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:42.342085+01
f1dbee42-da8f-43b6-88fe-d88a129ff532	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": null, "can_write": true, "can_delete": false, "collection_id": null, "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:43.549901+01
aaaabd4e-9cb8-4a5a-b99a-309146438cc5	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": null, "can_write": true, "can_delete": false, "collection_id": "employees", "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:43.582709+01
d380f677-8dd9-4517-b568-0d1e0c7ff399	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "name", "can_write": true, "can_delete": false, "collection_id": "employees", "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:43.614627+01
b1fa142a-e569-4000-bf72-77198f648de4	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "role", "can_write": true, "can_delete": false, "collection_id": "employees", "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:43.647383+01
23763eff-af15-4e5d-bb8e-71a9d012c65c	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "sites_lié", "can_write": true, "can_delete": false, "collection_id": "employees", "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:43.680342+01
8ee7086c-17b1-4543-8261-96d118609356	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": null, "can_write": true, "can_delete": false, "collection_id": "companies", "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:43.704711+01
042f578a-ba31-4573-888a-4fefe46bd955	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:46:08.984385+01
b444b494-cb4f-40a9-8247-e0eb0dded7b8	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:53:05.408237+01
b1d1578d-8d72-4fd8-ad84-19aeee8af5b2	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "name", "can_write": true, "can_delete": false, "collection_id": "companies", "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:43.737672+01
924f32a6-777b-4797-af41-72590c48e160	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": null, "can_write": true, "can_delete": false, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:43.770482+01
26f47e01-9e9b-4ee1-8c65-0f24b21fa838	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "name", "can_write": true, "can_delete": false, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:43.802516+01
5c445abe-7181-43f4-a2dc-2d4a9b6fff8a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "url", "can_write": true, "can_delete": false, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:43.835305+01
4e97ec03-93ae-43e6-b3c7-d756cfe4974d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "status", "can_write": true, "can_delete": false, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:43.868095+01
f8cbf75f-d148-4fe8-83af-c9f53e21f79b	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "dev", "can_write": true, "can_delete": false, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:43.892473+01
bc0efef6-8e98-486c-8009-b2fce329923e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "temps_rédac", "can_write": true, "can_delete": false, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:43.925462+01
9e61b26e-eaee-4730-891d-fc11ed073032	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "temps_dev", "can_write": true, "can_delete": false, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:43.958268+01
38af92c4-28cd-4ee2-985a-83c8d4d5ac55	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "rédac", "can_write": true, "can_delete": false, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:43.990221+01
586fa02f-2eac-4f91-a06c-bbdced7b19ba	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": null, "can_write": true, "can_delete": true, "collection_id": null, "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:44.323019+01
c83c8e21-e391-428b-b875-01be93656c6b	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": null, "can_write": true, "can_delete": true, "collection_id": "employees", "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:44.355897+01
d0cdc0ea-5035-4d81-afca-29a76836d45e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "name", "can_write": true, "can_delete": true, "collection_id": "employees", "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:44.38936+01
9c422e2d-7d07-46ba-b64b-a51b34a107a7	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "role", "can_write": true, "can_delete": true, "collection_id": "employees", "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:44.413263+01
d9839907-9837-4eb0-86fa-8cc033199a15	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "sites_lié", "can_write": true, "can_delete": true, "collection_id": "employees", "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:44.445195+01
dfe4dfab-c9bc-42f4-a40c-a1fde721037c	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": null, "can_write": true, "can_delete": true, "collection_id": "companies", "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:44.478012+01
fcb8618b-85f9-441b-9f11-1007a1cf8062	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "name", "can_write": true, "can_delete": true, "collection_id": "companies", "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:44.510831+01
23733f1c-3769-4156-868c-4f90c4db2f92	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": null, "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:44.543712+01
2da94d1b-0f50-44e3-8a19-53c3b098f64a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "name", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:44.568158+01
df0d78de-d464-4d95-a101-26d80e1ea1e8	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "url", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:44.601135+01
23fc56ed-7b6a-4cf3-807f-ba91959ca9cf	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "status", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:44.633004+01
551f7ccc-0134-450c-a849-464424759613	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:46:09.071678+01
f8c2129b-0dbf-4780-8a4a-5ef98bd5c8e7	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:53:11.456351+01
74533859-7235-4111-886c-4e6f05eaf4f4	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "dev", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:44.665845+01
c52ede24-1115-4c3f-ba81-1c255adc1a1c	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "temps_rédac", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:44.698676+01
a83cf7a3-6fc9-44b4-8329-3add4d687d5a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "temps_dev", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:44.731504+01
785cfb0c-2749-4eca-85c1-bfda1d27f12c	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "rédac", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:44.764299+01
b97dbe9f-bbfd-4b29-88f2-5df35beef400	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": null, "can_write": true, "can_delete": true, "collection_id": null, "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:45.321199+01
059e4f17-72ce-4a0b-84b0-06d3676ec113	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": null, "can_write": true, "can_delete": true, "collection_id": "employees", "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:45.354152+01
82fcae1e-d17d-48ff-81cc-4782116994f6	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "name", "can_write": true, "can_delete": true, "collection_id": "employees", "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:45.387438+01
9db495e2-1bca-4062-a9b6-4afc9d3780cd	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "role", "can_write": true, "can_delete": true, "collection_id": "employees", "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:45.42012+01
10820028-0b4b-4660-a597-ab1bf0243cf7	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "sites_lié", "can_write": true, "can_delete": true, "collection_id": "employees", "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:45.452756+01
ef7871d0-6b7f-44c1-8861-e4c6c65458c1	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": null, "can_write": true, "can_delete": true, "collection_id": "companies", "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:45.48583+01
5db2d114-6897-4db1-a938-ca8614254350	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "name", "can_write": true, "can_delete": true, "collection_id": "companies", "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:45.517513+01
dfa3aa37-1fb6-46fd-aca0-19b0e77d600a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": null, "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:45.550244+01
588050cf-dc68-481c-960d-4c7bcdbcb910	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "name", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:45.583092+01
4515bf0a-776f-4825-9968-0f041d4f2c5f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "url", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:45.615838+01
2564cb56-dfb4-425f-844c-fdace79ec402	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "status", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:45.648808+01
db154720-0ebc-452d-8e49-aa49f03a1157	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "dev", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:45.681674+01
ef50f5d8-52fa-4ac2-a430-7ebf4ede6ca1	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "temps_rédac", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:45.713504+01
948573b8-e306-4149-a522-e4cbdc333a6a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "temps_dev", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:45.737933+01
084f16bf-cbaf-40bc-b671-1311744438a9	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "rédac", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:45.770897+01
ed816bb3-6b11-4b35-8cc0-e68999aecaf3	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": null, "can_write": true, "can_delete": true, "collection_id": null, "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:46.111992+01
1236b85f-d9fb-4af9-aa2d-69112254bbdd	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:46:54.624571+01
e1cb0d45-27ab-45a4-a51f-7308a505e1e4	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:53:11.468167+01
694c1b05-cdd8-41e2-a9bb-54a1bc54978b	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": null, "can_write": true, "can_delete": true, "collection_id": "employees", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:46.144872+01
0f3fef3c-9cde-4bee-89b3-1edc45272c85	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "name", "can_write": true, "can_delete": true, "collection_id": "employees", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:46.176755+01
1461fc9c-e8fd-481e-ab2b-3a5bd983e9ea	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "role", "can_write": true, "can_delete": true, "collection_id": "employees", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:46.201625+01
0934eee4-cb03-4910-8523-323145e02803	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "sites_lié", "can_write": true, "can_delete": true, "collection_id": "employees", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:46.234209+01
0ddc4efa-bcd9-4125-b54a-89eb3a51731e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": null, "can_write": true, "can_delete": true, "collection_id": "companies", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:46.267155+01
69b062c0-e5b4-4fe3-bb2f-a1e00c2691af	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "name", "can_write": true, "can_delete": true, "collection_id": "companies", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:46.299848+01
1d92cae3-cf5a-4321-8d6b-2e583a9c4f0f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": null, "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:46.332786+01
07db0ebb-1ec6-4220-b82c-9f0908f6ecac	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "name", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:46.364627+01
0655c587-c37f-40b1-a938-47a5cf21443e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "url", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:46.397472+01
51269343-200b-435d-b3a9-bcb29a67d1d1	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "status", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:46.43039+01
4f3c7008-bf85-4351-be9c-209fa143e15c	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "dev", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:46.463148+01
4e8385cb-ed7a-4dce-9869-28431fc9a120	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "temps_rédac", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:46.49606+01
5f2c925e-aea0-4cca-8213-9f317bf48e4f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "temps_dev", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:46.528067+01
a106236b-313d-401b-b9ac-91b0d2633dd0	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "rédac", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:46.560781+01
87434308-5eda-4b34-a091-5fcfd1bd516f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": false, "can_delete": true, "collection_id": null, "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": true}	2026-01-08 11:29:48.243076+01
a2b4d2fb-7990-49ed-8b43-4c56a3ef6cc9	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": false, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:48.267469+01
615a4fe6-4c4f-4ae2-9568-b8c88d44f861	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "name", "can_write": false, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:48.300458+01
6c0cb885-714f-4726-82b2-8831cb762d5b	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "role", "can_write": false, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:48.33234+01
40eda60f-d37b-4087-856a-7a378fe6a916	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "sites_lié", "can_write": false, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:48.36521+01
3fe48687-6a60-44cb-b8d9-649469e6cb3e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": false, "can_delete": false, "collection_id": "companies", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:48.398001+01
2d4bc49f-0826-44f4-ba69-09b428081b8a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:46:54.649112+01
86aa2693-db5e-4d6f-84df-65c37faa8505	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 0}	2026-01-08 11:53:15.183921+01
b937f01d-a14a-4549-a59b-b2656d248500	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "name", "can_write": false, "can_delete": false, "collection_id": "companies", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:48.439459+01
492c641a-11a9-42e0-9fb6-eb7aec3f1453	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:48.47204+01
0b948a93-6a4e-468c-bb8d-48387d885448	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "name", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:48.504952+01
038074b5-4955-44ec-b116-cd8c15a7e2bc	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "url", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:48.811892+01
44992848-d8c8-4799-86a0-558b8195a84a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "status", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:48.836193+01
11958ac2-59fd-43f4-953f-4cb9cc327974	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "dev", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:48.860725+01
f3a18ce3-df6d-4322-a2e7-f2d7f9f9101b	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "temps_rédac", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:48.8937+01
cd58b923-dddf-432b-b6ee-eac0d46f25fb	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "temps_dev", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:48.92655+01
36b83c0e-d94b-42b7-b4a6-77350d39cc09	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "rédac", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:48.958335+01
0fb9ce7b-fb82-463b-a886-d634bd139cf2	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": true, "can_delete": true, "collection_id": null, "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": true}	2026-01-08 11:29:49.382882+01
a239583c-75b6-46a2-9e08-91e8684fb713	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": true, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:49.415819+01
d6703d7d-8e46-4981-b133-07cd183642c7	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "name", "can_write": true, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:49.440158+01
a005a225-948a-48f4-97ef-71fa266e29b6	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "role", "can_write": true, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:49.473131+01
6e274034-ccfa-4557-9a20-73fd61ce6c2b	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "sites_lié", "can_write": true, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:49.505956+01
f393f577-804b-4e1b-adfd-ddf76d7bbaaa	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": true, "can_delete": false, "collection_id": "companies", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:49.537947+01
8aa618d0-8fda-4b4f-a50c-7e0782d019f6	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "name", "can_write": true, "can_delete": false, "collection_id": "companies", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:49.562362+01
9faefb44-36df-4a39-8f7f-a07a0e068138	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": true, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:49.595248+01
d20d04e4-71c5-4daa-902f-f63685b57f74	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "name", "can_write": true, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:49.639949+01
e5420cbd-5627-46ec-bfe5-57fa83f8e712	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "url", "can_write": true, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:49.673133+01
992a7271-c94e-43a7-a664-7a8989bd3e8c	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "status", "can_write": true, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:49.697252+01
aa43f3c7-82f4-44c5-8b2d-2fc3c63bb88a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:51:15.831119+01
5ed44b7a-70b1-43f6-80b5-dc3f419a7296	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:51:22.464304+01
f0175fde-28ed-42b1-abd3-61593b2c3bba	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "dev", "can_write": true, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:49.73012+01
d6e05f50-3e16-41b7-9253-5fb5b38e2d88	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "temps_rédac", "can_write": true, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:49.763002+01
9f9c1cf7-f7ff-42b1-ab65-f8b770c29c91	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "temps_dev", "can_write": true, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:49.794865+01
dc668136-ebd8-4bff-ad69-5d8fd8b80313	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "rédac", "can_write": true, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:49.82769+01
460fef5e-b4dd-41e0-b430-1ac01f7611f4	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": true, "can_delete": false, "collection_id": null, "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": true}	2026-01-08 11:29:50.327343+01
ef3c4c69-abb7-4754-ad44-5e1855f5ce51	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": true, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:50.360082+01
2d0c7cb7-ad09-4551-b31f-5d1377ae6cf6	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "name", "can_write": true, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:50.392876+01
96ab6ff1-cb25-4d67-acef-7e113f3aea1f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "role", "can_write": true, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:50.481168+01
3e807f83-3649-4ed9-9b89-4545e69d0496	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "sites_lié", "can_write": true, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:50.537426+01
5348dc24-2df5-4877-8d2a-9bf92a13d501	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": true, "can_delete": false, "collection_id": "companies", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:50.581645+01
87e5253d-a02b-45c7-ab2b-5f317a6eecd6	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "name", "can_write": true, "can_delete": false, "collection_id": "companies", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:50.614498+01
2e5309b8-f4d8-479f-aa00-5532551dada5	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": true, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:50.647315+01
8bed21c2-da0d-4372-9254-885dbef5f6a6	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "name", "can_write": true, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:50.679244+01
92d66dac-a32f-428d-9d11-799b9e1371a6	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "url", "can_write": true, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:50.712103+01
22a9b430-0dec-46cf-bc81-a575f26201da	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "status", "can_write": true, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:50.744987+01
a3ac65b7-e496-440d-a7fe-d46ea62b4dc1	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "dev", "can_write": true, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:50.777731+01
5318bd4c-3f9f-4e00-8823-d3ad996d26fa	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "temps_rédac", "can_write": true, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:50.810677+01
4cd038f6-54b1-44b6-8841-9c25fe7bff82	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "temps_dev", "can_write": true, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:50.843533+01
134ba2ad-8712-4769-b30e-3ac3ced8ae57	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "rédac", "can_write": true, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:50.875477+01
bf4329ac-cefc-42d9-bac3-a028978666ad	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": true, "can_delete": true, "collection_id": null, "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": true}	2026-01-08 11:29:51.258318+01
0015d4a7-5154-4e93-8da2-39f062bc324e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:51:25.942459+01
e4c81cd3-db20-42e0-85d7-cb833cac76ce	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:51:28.286627+01
785a060d-0a04-4e36-8d6d-10fa200adc0b	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": true, "can_delete": true, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:51.291202+01
b15af7dd-44f6-4175-83bd-5afb35d83c39	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "name", "can_write": true, "can_delete": true, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:51.323989+01
8281859f-63ee-4a39-9418-4757c987f58a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "role", "can_write": true, "can_delete": true, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:51.35687+01
727b914d-fb71-4e6d-ba6a-e91215afee4e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "sites_lié", "can_write": true, "can_delete": true, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:51.388709+01
01620133-6a56-4b40-851b-655de7257300	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": true, "can_delete": true, "collection_id": "companies", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:51.421656+01
cabe7b12-51b6-48c4-bfd8-54668d1996c9	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "name", "can_write": true, "can_delete": true, "collection_id": "companies", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:51.454456+01
d3f9b369-d35a-4600-b63f-3d81b8edd698	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:51.487312+01
99a2a2a7-60a8-45d2-983b-772e7a1493cb	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "name", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:51.520203+01
7e2f253c-4cfe-4980-88fe-55a24226a917	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "url", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:51.553441+01
e29f1f8d-2ce9-443f-a38d-36aba6a48c43	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "status", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:51.584874+01
eb991cf1-c330-4167-ad67-9e8c8ea41ada	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "dev", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:51.617759+01
23d5c3a8-e667-4f8c-b40c-a95d97799e4b	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "temps_rédac", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:51.650684+01
7838cf7c-4af2-45ad-941d-a1d34ca0ffa4	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "temps_dev", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:51.683404+01
409cf9e7-2fa2-4a73-9415-4b7fc84cc4cc	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "rédac", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:51.71627+01
c60aad54-8c56-4ff2-a4b5-d72c5795b827	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": true, "can_delete": true, "collection_id": null, "can_manage_views": true, "can_manage_fields": false, "can_manage_permissions": true}	2026-01-08 11:29:52.844401+01
7204d4d1-f0c9-464b-be6b-382de8bfc6df	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": true, "can_delete": true, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:52.877213+01
8aa081ae-1a5b-49af-92be-7c652ae63707	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "name", "can_write": true, "can_delete": true, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:52.909953+01
7ee9517d-a625-4d21-a0cd-61a3caf97dbe	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "role", "can_write": true, "can_delete": true, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:52.942751+01
c6337cf8-2c69-497f-9ec5-cb248b4a8197	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "sites_lié", "can_write": true, "can_delete": true, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:52.97565+01
05784630-4a1a-4825-8efc-0724392487d5	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": true, "can_delete": true, "collection_id": "companies", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:53.008665+01
fded2527-c4eb-4c1f-ae3e-10144b85778f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:51:30.006589+01
3e81510b-2e1d-4d30-bb6f-7bbbd0bbceaa	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:53:15.208252+01
714f5832-75c3-4084-b5f8-fa88bc10bc3d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "name", "can_write": true, "can_delete": true, "collection_id": "companies", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:53.031968+01
4f15c767-3665-4ac7-a437-a762101f779e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:53.065092+01
6522e034-8390-4812-b224-5ae8019e53d1	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "name", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:53.089277+01
d0cc0508-3687-4736-bbb2-23b13c7f9699	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "url", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:53.113818+01
08893539-f007-4b4a-b632-76dae25bd6d5	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "status", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:53.138302+01
01c31116-bf82-4026-a4af-b7815469e82e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "dev", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:53.16193+01
d12bca74-b30a-4cef-b98d-def714ddd50e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "temps_rédac", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:53.186388+01
c5bd241d-0262-4189-bf92-5dfeca4d14dc	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "temps_dev", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:53.219706+01
88886996-aee7-4c3c-975d-276c7da1a55d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "rédac", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:29:53.252217+01
3e840e04-fae0-431f-a4cc-837be3e43dd8	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": true, "can_delete": true, "collection_id": null, "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": true}	2026-01-08 11:29:53.601371+01
a3b40a36-fa00-448b-b570-53ad473e90b2	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": true, "can_delete": true, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:53.634246+01
001cad67-b33e-4408-b7cd-ec3488b42c39	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "name", "can_write": true, "can_delete": true, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:53.667068+01
570eab0f-d571-4f39-9be0-0b44dffdbbc7	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "role", "can_write": true, "can_delete": true, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:53.699915+01
70e29cce-5896-4c56-934c-3ef57d3c0cce	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "sites_lié", "can_write": true, "can_delete": true, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:53.731763+01
86c1d28f-8f66-4991-b9a6-50250f306709	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": true, "can_delete": true, "collection_id": "companies", "can_manage_views": false, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:53.764629+01
e87a64eb-0f58-4355-9438-e85d187966f8	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "name", "can_write": true, "can_delete": true, "collection_id": "companies", "can_manage_views": false, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:53.79758+01
95de861c-e47a-495d-8369-e1d54bc9e29a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:53.830284+01
10e313f7-3f00-4484-8c1b-72192ca18ad8	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "name", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:53.863091+01
fd690aff-4d41-406d-8adc-d3ae02bf072b	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "url", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:53.895007+01
b24dc99b-d0a1-4d54-a80a-cb29df50e718	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "status", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:53.927819+01
97750f18-3db4-4e95-9610-1ab7a09ec374	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:51:44.225348+01
1faee12a-2134-4fae-a8e0-f4af89889d2f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:51:49.529672+01
be8b49c1-4581-456b-8981-47179e22aeb2	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "dev", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:53.960713+01
00c6e6b4-2a74-402a-93bc-d55f74d1109f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "temps_rédac", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:53.993643+01
72b4c7a5-c891-4da7-b984-fc3c5c36f9c0	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "temps_dev", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:54.026387+01
d5531a29-4f82-4306-ba37-c988630e8afd	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "rédac", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:54.059295+01
8a52216f-1ff0-426b-be6a-b72890ea3739	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": true, "can_delete": true, "collection_id": null, "can_manage_views": false, "can_manage_fields": true, "can_manage_permissions": true}	2026-01-08 11:29:54.449684+01
b8f8f839-837f-425f-97c4-059ed4782f6f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": true, "can_delete": true, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:54.473951+01
e790aaa3-ddac-4f91-a60b-9e506d49d13b	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "name", "can_write": true, "can_delete": true, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:54.506877+01
5310654b-4a76-4373-bb5e-c05913b7e11a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "role", "can_write": true, "can_delete": true, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:54.539653+01
7324e5b5-0b16-4cf7-ae99-301322432c94	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "sites_lié", "can_write": true, "can_delete": true, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:54.572521+01
919c69f6-54af-461e-b7d6-a21faa6d2f27	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": true, "can_delete": true, "collection_id": "companies", "can_manage_views": false, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:54.597038+01
61af9bd4-4694-4258-bcd8-c241daf5c695	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "name", "can_write": true, "can_delete": true, "collection_id": "companies", "can_manage_views": false, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:54.620537+01
99e7acf4-82d7-4084-b64a-ee2b947308e0	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:54.653509+01
857871a7-ae64-44ba-82f8-625e5d4e1343	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "name", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:54.686327+01
0dc3feb3-4d2d-4e1f-9dcc-24ed794974dc	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "url", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:54.710771+01
86332363-d211-4342-acde-24b88770cef8	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "status", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:54.74378+01
b8cb6934-d2d2-43cb-8310-aa885311eeef	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "dev", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:54.775644+01
bc254343-1c3b-4803-bf26-33820cf29fe7	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "temps_rédac", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:54.809013+01
c706a537-ef0b-4255-831b-8f9010399a62	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "temps_dev", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:54.841342+01
3735f6c9-9960-4baf-8876-1c375f0ce586	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "rédac", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:54.874279+01
2ad533b5-548b-466a-9b46-f8742bc78aea	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": true, "can_delete": true, "collection_id": null, "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": true}	2026-01-08 11:29:55.223686+01
c84be847-44ba-45cb-a71c-67b6c4800033	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:51:51.40019+01
b0cc7aba-7074-4fcd-82e7-34b82a75b7a8	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:53:18.56404+01
1dccf29e-519c-490a-aac9-fd1c7d9ba835	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": true, "can_delete": true, "collection_id": "employees", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:55.25648+01
c429b116-cb2c-45ae-ba8b-de82b4b3ba53	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "name", "can_write": true, "can_delete": true, "collection_id": "employees", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:55.28845+01
30060f43-91a0-45ac-8140-5e55c5468b38	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "role", "can_write": true, "can_delete": true, "collection_id": "employees", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:55.321261+01
a568878b-5299-4db2-a212-3a13c6435456	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "sites_lié", "can_write": true, "can_delete": true, "collection_id": "employees", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:55.345706+01
2a9366dc-138e-4b8d-bf79-cb0b52943eb0	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": true, "can_delete": true, "collection_id": "companies", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:55.37854+01
70e1e5de-dd07-46ac-872b-f8afda197cbe	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "name", "can_write": true, "can_delete": true, "collection_id": "companies", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:55.411468+01
1e7b97e9-9a14-4043-8b1e-c74937b50974	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:55.443395+01
68d3bd0c-6e7c-4a6e-ade3-cfbe5b2119f9	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "name", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:55.476328+01
b3280a06-4747-4e8e-889b-3bd08eca6318	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "url", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:55.509107+01
26289d60-0288-4421-87d9-e62302a4d330	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "status", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:55.639012+01
82e166f5-67f7-4318-aff3-f1b5e32a9aba	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "dev", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:55.751412+01
531dbd45-f7a0-4805-8dad-ff796ca139c3	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "temps_rédac", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:55.834176+01
c47010d4-160a-4a91-9335-5e2f6bf7d8cb	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "temps_dev", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:56.027451+01
9d785375-cd54-4fa1-bae2-e955d44317a6	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "rédac", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:56.839487+01
ed1ddad9-0a4b-436d-a1c1-c8ae8fe6be42	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": true, "can_delete": true, "collection_id": null, "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:57.631916+01
cfd49fc4-4ff3-4785-9426-68049469c387	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": true, "can_delete": true, "collection_id": "employees", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:57.664726+01
02ee1a66-23e2-4a0b-b763-b290b2208229	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "name", "can_write": true, "can_delete": true, "collection_id": "employees", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:57.69749+01
c6b4bbe6-3058-4e2e-b49f-b5501846026a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "role", "can_write": true, "can_delete": true, "collection_id": "employees", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:57.730346+01
e046ad9b-ca65-4447-bc3e-1ee8a9fe942f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "sites_lié", "can_write": true, "can_delete": true, "collection_id": "employees", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:57.763128+01
39c1630f-3e6f-4ad6-b28c-b0fece450371	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": true, "can_delete": true, "collection_id": "companies", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:57.795039+01
10ecbd1f-a389-49f5-bc51-bf39126fd4b0	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:52:17.466307+01
a1aacd8d-0255-4e07-a6ad-a387d57ed1d0	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:52:17.872908+01
bfc8f5c4-74f9-44f6-81e1-1a72b68aaf27	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "name", "can_write": true, "can_delete": true, "collection_id": "companies", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:57.827872+01
060dff08-a480-43fe-986e-642774e8d594	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:57.860767+01
7955d7cd-1fa7-4b97-8c8f-6442e0d53858	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "name", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:57.89363+01
6783f2ba-eb5b-4a7f-b451-3df86906070c	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "url", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:57.926526+01
96e33cb1-173e-4ba5-8f7f-e3284a5aaaa7	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "status", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:57.958308+01
69236413-2553-4abd-8aec-ccea6b0cbe2a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "dev", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:57.991217+01
132f0c40-e457-43f7-ab6e-f69566100529	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "temps_rédac", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:58.024065+01
4610f4c5-dccc-48e4-8b28-2ac236763b37	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "temps_dev", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:58.056893+01
3c64df49-e475-437a-bbd3-146c6dab2579	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "rédac", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:29:58.09817+01
3e7215a6-8906-4237-87ab-6c5ddb2b0788	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": true, "can_delete": true, "collection_id": null, "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": true}	2026-01-08 11:29:58.726194+01
e0a1317e-fb1b-41c1-87ba-a385d1427823	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": true, "can_delete": true, "collection_id": "employees", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": true}	2026-01-08 11:29:58.770662+01
2324c2c9-22fa-42b4-97df-1ab56bec8171	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "name", "can_write": true, "can_delete": true, "collection_id": "employees", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": true}	2026-01-08 11:29:58.80373+01
6c8fb939-d3e4-4be6-8b44-841bc9d53687	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "role", "can_write": true, "can_delete": true, "collection_id": "employees", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": true}	2026-01-08 11:29:58.836403+01
f332408c-6ea6-4add-b649-3cfc52d74ba8	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "sites_lié", "can_write": true, "can_delete": true, "collection_id": "employees", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": true}	2026-01-08 11:29:58.869738+01
ab9f7082-e6cb-44fa-9b09-b83930d9a4b5	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": true, "can_delete": true, "collection_id": "companies", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": true}	2026-01-08 11:29:58.902044+01
b93b986c-3abe-4264-b90b-bfb0467f9154	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "name", "can_write": true, "can_delete": true, "collection_id": "companies", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": true}	2026-01-08 11:29:58.934061+01
63c63084-cf8c-44d8-8897-5d33cbd49c58	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": null, "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": true}	2026-01-08 11:29:58.96706+01
38d08f42-eb12-46f7-aa5c-a479f5356243	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "name", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": true}	2026-01-08 11:29:58.999895+01
5d552137-884c-40b3-85de-aac63fcb6b61	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "url", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": true}	2026-01-08 11:29:59.032549+01
d4ba3857-15f4-4234-8c84-c9d6a0d9ac6d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "status", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": true}	2026-01-08 11:29:59.065401+01
bca6d612-463e-49ad-8746-4de615d31d5a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:52:32.369698+01
87d83ab1-92fa-44b8-8e6f-70c0c95f94e6	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:53:21.555765+01
9bba559d-a55b-462e-abbb-646798379a08	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "dev", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": true}	2026-01-08 11:29:59.097282+01
3a38e102-4fd2-4a1c-a16b-fd6e37de5262	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "temps_rédac", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": true}	2026-01-08 11:29:59.130127+01
ff719ef3-7b2d-469c-9ce0-a9e2443f739e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "temps_dev", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": true}	2026-01-08 11:29:59.163057+01
8d1a9bf5-c75a-46fd-8e1d-b38146669cd6	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	133acd06-d1e0-4be0-813f-52e29263b1ee	{"item_id": null, "role_id": "133acd06-d1e0-4be0-813f-52e29263b1ee", "can_read": true, "field_id": "rédac", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": true}	2026-01-08 11:29:59.195818+01
45b7340c-9f2b-4e6e-8530-94353be87f88	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": false, "field_id": null, "can_write": false, "can_delete": false, "collection_id": null, "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:30:03.389269+01
c01f6525-df47-45d6-bcb6-64a869e32b18	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": false, "field_id": null, "can_write": false, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:30:03.42064+01
fae3ecbf-7979-4783-b511-181436316fb2	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": false, "field_id": "name", "can_write": false, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:30:03.453364+01
26e8e0cd-9090-4f2d-8eea-85997eb33eb0	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": false, "field_id": "role", "can_write": false, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:30:03.486366+01
68c26a60-daa9-43de-999b-7f7e4e0f1e7a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": false, "field_id": "sites_lié", "can_write": false, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:30:03.519137+01
85c4372f-f4dc-4dad-9579-3389e1f4d0f8	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": false, "field_id": null, "can_write": false, "can_delete": false, "collection_id": "companies", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:30:03.551948+01
1ebadacf-3f19-49f7-a667-c563f9ac082f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": false, "field_id": "name", "can_write": false, "can_delete": false, "collection_id": "companies", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:30:03.584811+01
4c027f4c-9c35-4b5d-81a7-f8c74b5819b7	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": false, "field_id": null, "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:30:03.616688+01
cfa01895-cb54-41f5-85c6-d3b06386d9e4	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": false, "field_id": "name", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:30:03.641155+01
0ec1984c-e515-4937-a330-57e9127bbe3f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": false, "field_id": "url", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:30:03.665647+01
34779e57-841b-4c7c-91d7-5daa693fe303	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": false, "field_id": "status", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:30:03.698489+01
24d1ca0f-923d-447b-9d8b-fa9b481c6109	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": false, "field_id": "dev", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:30:03.731439+01
60e4c541-78d8-45f4-80e7-0538d1d909df	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": false, "field_id": "temps_rédac", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:30:03.754886+01
596f6a88-1589-4d5a-832b-78954d10a423	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": false, "field_id": "temps_dev", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:30:03.787858+01
be5d35ad-57b7-488c-b268-8bdf584fc72b	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": false, "field_id": "rédac", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:30:03.820719+01
94d0d91b-b3f3-4155-b948-a176ca26ca8d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": true, "field_id": null, "can_write": false, "can_delete": false, "collection_id": null, "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:30:04.170303+01
d19946e1-6d91-4128-b0e7-1f1514c9ddc7	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:52:32.384192+01
a22d48d4-dce1-4b3f-b34b-665ce64e4dd9	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:52:33.701306+01
868705ad-409f-4bca-a568-abb0852b1e7f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": true, "field_id": null, "can_write": false, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:30:04.203024+01
09bd380c-0c47-4884-9fa5-f08d33af0a83	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": true, "field_id": "name", "can_write": false, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:30:04.235941+01
43e92429-37a5-4daa-87f4-a01e111d0b78	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": true, "field_id": "role", "can_write": false, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:30:04.26779+01
6c0603c3-947e-4bda-a800-0d0020f879f4	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": true, "field_id": "sites_lié", "can_write": false, "can_delete": false, "collection_id": "employees", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:30:04.300707+01
80c985e6-bd10-4ca8-b96e-42561a8005db	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": true, "field_id": null, "can_write": false, "can_delete": false, "collection_id": "companies", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:30:04.333633+01
508b9a64-8fc9-4261-9c53-359e123939d7	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": true, "field_id": "name", "can_write": false, "can_delete": false, "collection_id": "companies", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:30:04.366324+01
41e72697-46a9-4e10-b603-10455060de3b	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": true, "field_id": null, "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:30:04.399303+01
34803696-6ca4-44c0-8880-d53bfc05589f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": true, "field_id": "name", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:30:04.431071+01
895a8de7-64a5-4078-bf24-086a0192bb9b	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": true, "field_id": "url", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:30:04.463962+01
412995fe-97af-4668-801b-7dff2d08f89f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": true, "field_id": "status", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:30:04.496789+01
5ce553bc-742c-40f5-9afa-0bb85d5751a0	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": true, "field_id": "dev", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:30:04.529812+01
c47b984f-44dd-4b93-8e69-084d0a4b2884	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": true, "field_id": "temps_rédac", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:30:04.562646+01
51f5a25d-30b7-4164-9cc2-22023bd90617	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": true, "field_id": "temps_dev", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:30:04.595383+01
fb5ed25c-6ebd-4d3f-8543-00facf3a5bf7	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": true, "field_id": "rédac", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:30:04.627204+01
16ebabb2-9d50-424d-9373-6e5f8a7d0130	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": false, "field_id": "rédac", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:30:11.352381+01
fac5d024-ef71-4ba5-92f0-1224d0200f21	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": false, "field_id": null, "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:30:11.400681+01
d8b4e7c5-c745-4d0f-ab96-99a9eab6398a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": false, "field_id": "status", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:30:13.450155+01
90738220-060a-4c53-91bb-ca75a8e124ea	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": false, "field_id": null, "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:30:13.482901+01
806eb1aa-05c0-466d-8db8-e1330e84d3f7	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:30:20.430822+01
415b6c8c-a1de-4f17-b383-645742337099	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:30:20.471722+01
89500370-f000-492b-a43e-515bea178ec4	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 0}	2026-01-08 11:31:39.443349+01
07b91b5e-b6d7-4e6d-81f2-0d9154175f8c	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:31:39.478355+01
bfba655e-2d6f-4d25-b715-893dcefa6080	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": true, "field_id": "name", "can_write": true, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:31:47.566587+01
f957ee54-b772-4a19-863f-6fc79d59d9ec	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:52:34.534218+01
ac468c16-8024-4489-a514-853a92e3560d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:52:35.333871+01
13298df2-f014-4583-a784-b1d2a466d412	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": false, "field_id": "url", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:31:49.582695+01
13e7f99a-437a-4275-9ae1-15612578cf72	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": false, "field_id": null, "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:31:49.607124+01
15eeffba-919d-4de3-9b48-9436437ca044	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 0}	2026-01-08 11:33:43.472421+01
bb3f78f7-09eb-43b3-bee3-a5546cba0115	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:33:43.504864+01
414946f6-cadb-4581-94e5-78930175917d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:34:01.139863+01
7ba6905c-3572-4543-a352-5bc2c2194074	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:34:08.2848+01
15c0e156-316e-424c-8d58-04520f4ea95c	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:34:14.189808+01
40167cc9-004a-40fe-909b-e1b442512a1b	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:34:14.764629+01
c3961740-b1bb-42d3-9a0e-bd26da36f7f4	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:34:19.817417+01
0db3aebc-34b6-4967-9f86-8d342060ec68	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:34:20.149837+01
56010ad6-2f42-495e-8b42-685160e024bc	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:34:20.604599+01
c95086a6-fa5d-479b-8e01-006251d404e8	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:34:21.115613+01
d528a1a9-5639-4908-b983-f6143046a979	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:34:28.828443+01
582377af-b534-40b4-9146-128f1732b9d5	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:34:30.32272+01
450407a0-37ea-4bcf-b326-e7aaaf9cf28e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:34:30.984833+01
ba8a9edf-0432-48a6-9466-1f034bff9519	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:34:40.459986+01
7e4a96dd-fb6c-4a51-9c62-85f411aee850	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:34:40.484565+01
2e6df164-e7e5-4368-86b5-6743a2e6b61f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:34:43.612607+01
bdd919ea-0fb2-49c9-9638-9dcefc014912	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:34:43.636896+01
eb68013d-8aa8-423d-b6c3-f082ae9a5bf9	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:34:53.08711+01
1e24a1f1-444e-46bb-841f-aefe04e0a442	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:34:53.111455+01
00d9d03b-58a4-4b98-9dab-2acb0d142988	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:34:58.711208+01
d5f8b2a5-9e61-4116-9861-008a47874fbd	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:34:58.735261+01
601e394a-c598-470a-98f4-6d6df3902bcb	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:35:08.00672+01
a8eba5ee-fc28-4f55-8481-c8dbd9d26967	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:35:08.029889+01
c755a376-a800-45bc-8409-d5931144cec5	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:35:20.317362+01
d8b669e1-b4f9-4476-a96f-ea7b43ecb7aa	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:35:20.330761+01
5b59dcae-8ae5-4e97-99d6-6b559fd1f5be	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:35:20.355696+01
59dcc625-9b40-4ba4-ac32-976618476fb8	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:35:20.367206+01
a0b1bef1-0218-43fe-9521-20d6987fcc67	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:35:22.295091+01
4258d975-f722-4600-a67d-c40ea9059435	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:35:23.842649+01
db596f77-0674-47ba-827e-9c1f39a5a6c7	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:35:27.326022+01
13a1d501-210a-478f-9c5a-92fc138db819	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:35:30.736821+01
339841d6-c877-493d-a824-3be3fae5c7d7	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:35:30.761122+01
c401f28a-5234-4e40-b99d-0b4b33474841	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 2}	2026-01-08 11:35:40.45294+01
b8c4d6f5-ecb0-447c-b53a-3ac777e071d3	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:35:40.485659+01
11185cea-2a1a-4c98-aaaa-839420c3d4bc	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": true, "field_id": null, "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:37:30.811057+01
a21dc465-d105-43f1-b749-26d23a26b261	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": true, "field_id": "name", "can_write": true, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:37:30.843753+01
693a20c3-6bcb-4bdb-b00a-6d939a0dd0ab	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": true, "field_id": "url", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:37:30.876432+01
9acce703-afb7-4ebf-8a6e-69fba391a92c	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": true, "field_id": "status", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:37:30.921129+01
fb8b749a-bc3e-47fb-a33b-daee06653aba	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": true, "field_id": "dev", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:37:30.970827+01
f412b15e-327a-451f-921f-706b71b4610d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": true, "field_id": "temps_rédac", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:37:31.020025+01
1469a2ee-aa30-495f-b8fa-aa764fd5e449	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": true, "field_id": "temps_dev", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:37:31.051068+01
73eb7833-b0a2-4cf1-bd4c-44b7db2d4a05	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": true, "field_id": "rédac", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:37:31.08387+01
db7068e1-1400-4995-a515-39da9297ed08	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": false, "field_id": "status", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:37:33.142606+01
139692ab-b92c-4776-94dd-7596b2fdb2d6	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": false, "field_id": "rédac", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:37:36.716359+01
65604a6e-791e-475a-a07e-3afae44e5bef	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:37:51.005155+01
adebfde7-97c1-4fcf-b111-2accec1a8fbf	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:37:51.069149+01
924aa336-fd0c-45f5-b751-9a51139977c1	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:38:02.559004+01
1f81b5d6-1ede-48c4-961a-19475225b8da	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:38:02.583226+01
9f4b5cce-0cb2-4e01-ae45-3d152c7e1cc8	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:39:34.707803+01
6790272e-a117-43bb-a6d1-a5dd95a1fc67	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:39:35.755471+01
b22dee0f-963b-40f6-ae25-d6cbcaf402e8	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:39:49.063681+01
a0e6c7a5-8bf9-47c3-bad6-87a558a3bf40	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:40:27.382848+01
a14d5cd9-aee4-4df1-880a-ff7b8c2bcacd	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:40:51.844583+01
56c0d3c0-8221-472e-bdc5-c18918fbabef	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:40:57.489605+01
d6ab2fbd-d690-4310-ac68-30bd6937eea7	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:40:59.593284+01
0721a822-a449-419c-b786-d49d967b8939	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:40:59.605161+01
2818310b-9f3a-4bdc-b9ae-60880a8c4343	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:41:02.641283+01
8549da3e-eef0-46f1-941f-b33ba4bccccb	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:41:04.947641+01
05bc7f66-8c92-4790-b2e5-afee21909b39	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:41:04.957391+01
98268b9b-fed7-4e46-bffb-0f58259bc01a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:41:06.780109+01
f7aa0a51-eb6b-49a9-bc18-7cc260d8df27	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:41:06.812961+01
288329b1-add8-4a50-be9e-d2e2fd603856	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:41:10.975797+01
37b62276-1ad0-4b21-a69b-77f77e661cbc	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:41:11.008503+01
b03fab91-1354-465c-bb10-00dcd5d2325c	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:41:17.796023+01
9a28d26c-0488-473f-a105-62c309f2a3e3	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:41:17.857943+01
c6a01277-ee7e-422e-b900-a49f54633341	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:41:18.40394+01
22e0e6dd-75fd-4844-9e77-9402f7d8d088	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:41:20.611258+01
d7764795-8b91-433b-9b57-d003ed39c48a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:41:20.635673+01
dd5f0a95-8d83-4432-8f19-81bd1b24caf9	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:41:21.531477+01
c2a1c4d5-af04-462c-91ac-3a2fa9bbb7a0	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:41:28.677508+01
72c16214-7dec-423a-ba65-bb6f14cbeb24	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:41:29.234177+01
0695982a-26a3-464a-8cd1-d8833924537c	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:41:29.266651+01
7d5c9ffa-3776-4aa0-b5da-0f36aef227c7	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:41:30.482877+01
e8d05109-d4ca-4dab-9dd1-ebf11ad549f1	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:41:33.390016+01
cbd07532-982a-4257-957a-0783eef4c732	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:41:36.373369+01
75c5230d-5a83-44a9-bfc8-9be4786cbcdb	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:41:36.386188+01
3e8e12df-0d8e-46a9-bdce-e579d2a54965	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:41:56.099468+01
bafcffa5-4b8c-40d9-9b81-66499d2d1026	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:42:01.764944+01
e566da2a-d9ac-4ec4-b17f-c4ad1f564ba8	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:42:01.971753+01
1f170719-1c24-4dd9-b64a-c571dae6f0f3	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:42:02.11284+01
54ea3e20-9b56-464d-905f-952150bec0f7	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:42:02.279166+01
f55e30f6-efb4-42fb-8837-2af339260d90	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:42:05.093043+01
6a11e926-a217-423a-aa6b-809b8a932a72	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:42:09.546869+01
b2afc782-8dd0-4e3a-9d9f-0854a5bfb106	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:42:12.470191+01
2876c97f-305f-4e66-bff4-787b8c37d809	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:42:13.710622+01
f79efc3a-2156-4fa7-acff-a5aa852d1081	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:42:20.34718+01
eab6942a-2cd8-44c6-b35b-167a76e760fb	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:42:20.359051+01
cb6d1be5-dcd4-4428-86d0-5aae88034b36	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:42:20.396377+01
53713b6c-bd61-4309-823b-79afad5cbc48	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:42:20.419672+01
2eb4dda4-2e95-4411-b823-bcd46083db05	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:42:38.63587+01
e5c3b08b-a897-49e7-a23f-33fda36772d4	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:42:38.667696+01
8517e1b8-671f-4ff7-96fd-4c7eda3244db	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 0}	2026-01-08 11:43:15.13972+01
5c64b9ca-2529-4732-afc4-bf52d6baa7c4	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:43:15.163795+01
e9882d2b-a82f-4f8a-82c9-d771ebdf3402	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:43:28.193826+01
4facc789-d88e-42aa-b476-be838641ad9c	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:43:28.21798+01
56bb51b8-2cc1-451e-95c9-3567a06d366d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:43:35.131226+01
b9a1d796-0d05-48d3-ac12-780a66ee9a2e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:43:35.155627+01
a2b50f71-0a6c-4aec-b2d6-e5e117564967	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "url", "can_write": false, "can_delete": true, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 11:43:42.848608+01
17530d00-0d50-444a-a029-40b56b8db854	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:43:46.295709+01
a1e10698-9a92-4679-8e09-99e55956ddad	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:43:46.320458+01
386ac8dc-805a-4714-8d1c-5aa54e4933d1	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:43:50.0325+01
1ee957e2-ea4a-4631-80e4-39068d2a9cba	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:53:21.571483+01
e1d94582-0972-449b-b57a-d6f3d17d45a5	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:53:34.375209+01
5ee48255-3961-41de-a7cb-82b571dd08ee	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:53:34.399635+01
678e5809-f04a-4b5b-b21f-5efd16b7580d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": true, "field_id": "url", "can_write": true, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:53:42.025863+01
9aa1fb77-dcb5-44f8-a301-0ccee5c7e9ae	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": false, "field_id": "temps_dev", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:53:50.052711+01
b325da60-6fd5-4b1f-b78a-eb7f5fe289a4	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": false, "field_id": "temps_rédac", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 11:53:50.647271+01
86cb769e-1c73-402a-98bc-7fdce37d1846	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 0}	2026-01-08 11:54:08.543625+01
5d99006b-9e6b-4467-a3af-fb10ea94ce5a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 11:54:08.575254+01
d83478ad-f75b-42c9-97fe-9eb27ae68f49	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 0}	2026-01-08 12:06:26.097691+01
8b225575-292d-4cc1-94ca-e626c6b3cbae	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 12:06:26.109147+01
f99f7d0c-14b2-4b33-9ba0-9cdf5ce1e5bd	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 12:06:28.205642+01
d0cd76c4-7f61-4bbe-9075-74936df2f2d2	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 12:06:28.228819+01
651cf2c3-45f9-4fb3-853f-4a057f7600b9	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 12:06:33.909334+01
9d8f1f9d-9dec-45e9-a167-2d5dcbca9e16	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 12:06:33.918485+01
9f3f3dac-f800-4b52-9cde-c04b9719ef5c	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": false, "field_id": "status", "can_write": true, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 12:06:41.08627+01
5ba5396f-7abf-4d74-9295-b34c439a0287	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": true, "field_id": "status", "can_write": true, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 12:06:42.352647+01
c4c00347-1007-4153-84d0-c20d0492c90f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": false, "field_id": "status", "can_write": true, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 12:06:43.019214+01
9eaed3ac-b9df-4299-b4c6-98939ddfbcea	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": false, "field_id": "status", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 12:06:43.485006+01
69f878d3-dca5-49b5-b73a-239c25a1cdd7	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": true, "field_id": "url", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 12:06:45.448782+01
5fed0443-3bc5-49c5-b2d0-1448a022ee8a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": false, "field_id": "url", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 12:06:45.914837+01
3b8c99ad-0f8b-4043-95f0-5b410c5d62d1	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": true, "field_id": "url", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 12:06:46.555937+01
9ae4909c-6728-4a1a-ad33-df27b66c798d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	e8b2d77a-7e32-434f-b894-4291837038b7	{"item_id": null, "role_id": "e8b2d77a-7e32-434f-b894-4291837038b7", "can_read": true, "field_id": "url", "can_write": true, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 12:06:48.027702+01
c4c125e7-0e64-4005-8ebb-3d7ddafc35ee	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 0}	2026-01-08 16:24:26.076618+01
9749f26e-9689-4383-9112-509e68911f1e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:24:26.114158+01
b620166d-eb9d-4e51-be6e-4adefc641a01	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:24:28.360307+01
cbac5483-b22c-476b-bcd1-9313a60fe8bd	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:24:28.383837+01
0b4569df-968a-4cc7-bb31-d57fabee5838	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:24:47.057097+01
eff1e4f4-c1bd-4244-93db-15592cf0d5e2	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:24:57.088472+01
81a007e0-b249-4076-bfb7-362904d5b8b0	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:25:03.545211+01
c8f4004f-5f51-422a-ad5a-e870a6709bc8	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:25:55.472826+01
8799f72d-6508-4413-ada3-70fcade57ce3	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:25:57.224452+01
11079626-52a7-4bda-b807-9a62f4009379	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:29:39.442625+01
d2cb2209-5431-4af6-94db-128419e43f70	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:30:43.930077+01
4d54e996-8e6a-4433-9bd0-1ca03afbb5ba	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:31:54.352611+01
f0f950a6-b7e7-402d-ac52-73b83a650b4b	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:31:57.752173+01
95a021fc-e7fd-4a6b-9d44-e280c1d03123	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:32:01.76408+01
ee18c368-6473-4401-8a85-8dfc1393d5ec	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:32:05.560202+01
5a39c43a-df22-4439-a19e-57f6a3f21aed	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:32:07.472911+01
3b1f89df-5f83-4f0f-ae11-8efe29282696	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:32:12.296374+01
9490f121-ff41-43e9-8289-d3d65f7efde8	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:32:15.16901+01
427267f9-6e25-45ac-893c-b7b26074d9b0	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:32:24.646341+01
eeef5e1e-961d-4df7-9a61-b6d18981b97c	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:32:27.313416+01
56dd4d75-3f51-4273-ad6e-7d92c4b599c2	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:32:30.515045+01
fed825a6-232c-4418-ad2b-071d9fdc0026	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:32:59.536386+01
a9c9dc3b-a642-48b2-ac15-60b3c3b48785	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:33:01.991639+01
9bbdec8c-d0ee-4569-8e30-22a46b60a10d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:33:41.015202+01
a257e82d-ee0b-485a-963a-8e3d2aecfa7c	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:34:08.201445+01
d6ca34ea-6996-4ca9-a74a-340b95ffb27a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:34:10.381716+01
42039ff1-8da1-412b-880a-0fbdb9864503	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:35:08.278157+01
f87e572e-a309-4e87-a2a0-7e3b5d7851c1	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:35:12.31436+01
0f27d32a-717d-4820-bd49-a9921d096f68	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:35:18.260002+01
39a5c883-00f9-45af-b17f-55f416eec024	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:35:26.466227+01
9b2296d2-2f6e-456b-a1da-021d2c53d899	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:35:37.320023+01
6ca92543-fb20-4457-a87a-e3eddc43b6a2	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:35:41.378858+01
901b5452-ac04-4a25-af54-806ead7e8d21	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:35:44.271903+01
c796ff8b-0d11-4e18-90ac-19805fb4091e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:39:26.836709+01
7af6a4db-d18d-465c-9862-a09645520432	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:39:28.436264+01
c9d8ecb5-fe01-4e17-a83a-1533171ac12d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:39:38.782172+01
f0335969-49ea-4bd2-b24c-8be5427d3683	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:42:41.90937+01
874f5f3e-4397-48b3-91ba-15d68a5729ac	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:42:41.98035+01
aae16eba-3f56-4e68-bb4a-f728e103d6c4	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:43:02.734575+01
1bdb0f22-064b-452d-9af3-2edbe5033b1a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:43:02.758078+01
3f379f61-6a13-4399-92ce-38b7ee9a8127	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:43:07.700687+01
576dc30f-8f83-43f5-8f8f-1240e45fa57d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:43:16.542802+01
1190f06d-6b25-490e-b3e4-be847fe64f56	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:43:26.079952+01
b889ee65-142f-44e4-a7ac-524635f4f1bd	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:43:29.163707+01
58b7a26b-2455-4c3c-91d6-d4ed4c10baa4	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:43:34.594864+01
4cd22a0c-8e4d-47de-94d7-99f947122a40	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:43:39.892322+01
7e7e1555-c00d-4268-9362-a079375de95e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:43:40.269822+01
b0719c4a-54b3-4710-910c-99bd32f9009e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:43:40.969275+01
f52f0621-3cd1-4c85-96bf-67794e24e82f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:43:41.452248+01
04b15fb7-3c2d-45d3-99ad-dd1dfc858c32	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:43:42.125722+01
8576ded6-5941-4767-a1df-a17ef18c14aa	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:43:42.940477+01
04e88305-2f38-4f0d-ba71-1b387d594a89	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:43:43.689887+01
4f86edd6-ac2d-4706-ad94-588782c184de	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:43:55.811235+01
36c84bed-cc19-4a12-a528-11629fce20d6	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:44:06.637984+01
c3b54765-ef64-47a4-a54d-287248474272	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:44:08.385622+01
57de4691-dca6-46a8-b02b-87035a302bcc	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:44:13.283914+01
531facbe-32ff-4bc2-96d6-52b6042b912e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:44:14.987806+01
a41ad8b1-4750-4033-8494-6ac845dc67bd	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:44:25.403255+01
7b177f69-9649-481b-92d5-3dba84b719e1	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:44:26.492182+01
ca038252-d93d-4fc7-9ea7-2c693fac2f7b	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:44:30.737127+01
f45dab76-1c27-412f-8b9c-a1ebfd64211e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:44:31.986053+01
b5d06a78-6558-4649-8842-a32d22371a78	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:44:32.783961+01
d8dfe655-5c14-45c4-bfa5-e4d69e140309	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:44:50.47198+01
f8d7eb29-daf2-45e2-ba94-9066f010c82a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:45:00.056551+01
e897d755-21fa-4a0b-923a-a0aa63740755	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:45:04.231499+01
dddf5549-aed5-4898-a230-b7c55a3bbac0	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:45:05.917483+01
dddb3b4d-eef0-43d5-9534-88059e3eb184	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:45:13.310732+01
cec9a24e-7563-4a8f-97d6-10dc107ba204	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:45:15.929753+01
31ab166a-44cc-49d7-b468-979529b4a4e8	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:45:16.742654+01
2ba21bea-77b5-4202-bd8d-a57655d6158b	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:45:18.067111+01
a6ad06f9-065d-44ce-96a6-de24a579edbd	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:45:18.983211+01
239ee39d-c9be-4053-a260-86a0e0799230	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:45:30.422723+01
79c7d164-5982-43cd-8932-5cf22e1552cb	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:45:30.485784+01
d37deafa-19f5-4a61-b9ae-36d59d1aa73c	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:45:31.682141+01
1d703ad3-2088-4766-9e24-dee92d5ea079	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:45:31.989951+01
4289076f-15b2-4c44-a5e1-5e258e933725	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:45:32.431081+01
b0122388-51ec-40f0-9283-4d5e90824e78	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:45:33.545301+01
11d5b6da-e123-45b6-9bf1-ff365982fc77	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:46:03.403635+01
8aba93db-1cb5-47d3-862f-cdf36808f5ad	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:48:23.683912+01
c6a35e97-8d60-44f5-b497-6ab4c49fd533	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:48:23.7238+01
ac221632-6699-4005-83d4-c729308a36a6	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:48:39.461262+01
b8365877-1bde-4720-9ff6-e7b22f159450	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:48:39.484817+01
4a56a47d-00b6-492d-a27f-2a490e8cd3a6	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:49:17.663909+01
15660537-7ee6-4a5b-9b45-936ead798f2d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:49:17.687389+01
2ff64606-12d8-4784-ac34-cb823b80a88a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:49:29.130107+01
be6d875c-6574-4f0a-920c-514be05df63a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:49:31.860348+01
9f3ea0e8-ed3b-4fb6-b0dd-4768d4326506	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:49:38.484344+01
9e6a35d4-4aa1-4b50-8788-7cdd492dc697	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:52:10.317828+01
0799e344-488d-415c-84f2-9cbdbfc756ea	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:52:10.333919+01
16b8f1ed-e1c5-4fbe-a123-3ac42009b1d1	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:52:19.498983+01
b4b505c4-eacd-453d-be90-0995fb76b0a8	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:52:22.341554+01
245a28c2-4b0a-4680-889e-302b0406acff	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:54:11.326406+01
816796b9-6bd2-4a0f-843e-4d4efa3f7167	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:54:13.981424+01
ec376f8f-5abb-43ec-a665-d8e5d0942685	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:54:14.981396+01
16e14a60-3552-4796-a5f1-541965344884	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:54:28.51393+01
14ae0e92-d832-4c5b-afd1-c07b2ee969ad	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:54:31.887271+01
a98b1791-87a0-4f0c-9dcc-360b27fd8671	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:54:48.295282+01
0746bd81-0315-4fbf-b7aa-114314e6d5f7	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:54:56.829962+01
64b4ad5a-1a82-4770-b367-734e4829bd47	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 16:55:09.575171+01
2ced948d-832f-4772-b96f-49b8f5bcaa2f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:01:26.777333+01
3c3f5142-eee1-4a37-87e1-291714e3b604	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:01:31.911909+01
cfcafdd2-2649-403b-888d-c9db5c0e5322	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:01:47.38676+01
7a75d508-b90d-4332-9ca7-70bdda76b79d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:01:56.063241+01
9c1e087d-e6e3-4ddf-b16f-d52840d4f39e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:02:01.238845+01
3c4d638a-9b80-48fa-b978-d58f5b8611cc	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:02:03.05598+01
ff6dbb68-79fe-4983-ae9b-8ebc62a63b43	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:02:04.974589+01
43643643-a7d2-472d-ad19-a765c83229f8	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:02:06.56589+01
74d7cc35-b209-45cf-bdd2-e38d38c01506	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:02:07.340284+01
86830d79-ef92-47a2-a1d0-9e8fa7d06a97	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:02:09.10645+01
0fbf126f-0d7e-49de-a4da-074bbb1c69d1	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:02:13.42252+01
632cfb67-7e01-4e8f-a21f-7cada6ba0ceb	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:02:17.784464+01
1de699c5-282c-4d65-872f-2ca33e8258a0	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:02:19.096152+01
4fe55621-b41c-4c24-8725-c6e746b112b6	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:02:22.287975+01
f7be4761-d5b0-4a1b-85a6-b8620f8e7fb3	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:02:30.260068+01
0920ac14-f163-4f30-b262-d89ea0597dd2	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:02:33.964413+01
92501ebe-d5da-4542-95ff-dd89567c6856	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:02:37.030066+01
250596d7-0707-45d3-8b87-8946f1f2d5db	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:02:39.645404+01
02ac1485-1b74-44a6-92f1-ba4615db6061	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:02:42.085205+01
51387a0a-c7c2-4ca1-a2cc-203cb824a039	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:02:43.408655+01
f3113f5f-b8e7-47d2-aa36-626876d8be8f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:02:55.225338+01
e5c26966-2543-4ece-b657-24d8ce269d80	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:02:56.365835+01
116fc315-72f2-4395-a6b9-cffda3c0775b	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:03:05.027465+01
7dd5cf1a-0fd2-4a2e-9b8c-f059bc816ad5	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:03:10.34182+01
054fe7b9-1c21-4af0-b883-551f935308cc	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:03:13.726941+01
c774225d-d70f-487b-b1a6-92d555127319	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:03:17.617058+01
261f31d4-9931-400f-91ca-8e0011421c44	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:03:20.82347+01
599b5472-a499-4d5e-a3d6-49d12d5597f6	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:03:21.221554+01
a69e7803-5a10-4034-bcf6-24408b7fe8b9	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:03:21.362769+01
bda26f97-494e-452e-9604-8e5077856cf0	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:03:28.25557+01
acc7708d-5de5-4c70-97ef-8bbc7cf3f50e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:03:29.716962+01
92560bed-c139-477f-a5ae-330977eb8f4e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:03:30.830183+01
b4eb9be7-daf7-49c5-98cd-c4d0d833f8f1	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:03:31.673843+01
629fec42-7542-421f-8f8c-99ce2da124e7	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:03:32.313924+01
73ecf9e1-1547-46a2-b290-9af8e9bc969a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:03:37.261701+01
356cc84b-e93f-4a85-a142-6dd122e882cf	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:03:48.612491+01
34a7f093-7e1a-47c8-9868-390adab51d9f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:03:50.823362+01
caa80ce0-67e7-4ded-865c-cc53d53f58a7	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:04:11.069619+01
493bef31-4659-4147-8d8a-a5bf0e545956	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:04:14.512008+01
befc45f6-7289-4704-be94-76dcf2db08f8	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:04:17.152523+01
0be09ead-b7db-498a-be0b-b423b8a478cf	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:05:05.289344+01
efd8d86d-d099-435f-92db-b1b729a7085e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:05:26.278997+01
ee0a0bfd-03a9-4aa6-9aa5-166ff67e363d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:06:08.367625+01
05d1bd7d-a8e0-45bd-9d4c-4b3737e68dac	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:07:13.375634+01
e271af00-3720-4340-8015-138d0b8715fc	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:08:25.628678+01
3c15d8b6-2802-409a-a050-9a7c5e233339	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:08:34.90371+01
71dcab68-90de-4241-b57d-b5dc8e39c499	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:08:58.732816+01
d3afc370-0d17-4a38-9827-05c490657193	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:09:20.91193+01
6b52be25-c463-47ea-a400-d6a61190c562	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:09:23.031812+01
db24d44e-353b-4bae-8226-30566786395e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:09:28.194381+01
b0aeadd9-ecef-4074-934b-6ee8d6593347	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:09:28.235511+01
b487e735-8ac1-4f00-b623-1a2ebff9aa8a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 0}	2026-01-08 17:09:31.723649+01
53cf471f-e480-416e-980f-30b0203cdf0b	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:09:31.748069+01
4d6e0d49-6118-4522-abbf-c7774338a9b7	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:09:33.970627+01
5fc822c8-f466-48e5-b99b-d6eddec52849	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:09:36.345238+01
1287f3b1-a25c-4baa-935c-5f8b2de3d4c8	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:10:17.745136+01
fbb335a1-66d7-4740-9b17-0ce0f70c0759	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:10:18.187173+01
e1dfa91c-eebb-4bad-8855-837decdc61f2	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:10:18.511872+01
792a3ac6-040f-47f3-935b-cab2f55336d3	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:10:19.261378+01
e4d68a6e-be30-499e-8d51-04fa92828523	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:10:19.369125+01
9d440639-32c4-4949-8ee9-9c891c242e65	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:10:23.499809+01
acd9be29-c754-4ba0-84a2-6a8841f0dfee	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:11:10.895872+01
4ec3d0fb-5d66-4f21-938d-46ae45f676cd	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:11:14.103912+01
ea5189df-5849-492b-a6d4-c2a00446135a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:12:40.927462+01
c654f56e-117a-4e1a-ba63-a4d42590577e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:12:44.644978+01
5edf4cc6-26f7-47ca-b5ad-1789ecc1a8c4	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:13:51.104854+01
e584f223-cb95-4399-9ca1-da87f4f07c59	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:13:51.254417+01
f9423936-2abe-4055-b6b6-729d84a533ac	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:13:58.06266+01
aa535856-58c5-4dc5-abeb-056c2ecd76a5	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:14:42.366486+01
cdd48e1f-5100-420d-baeb-ffec0bc5cc99	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:14:49.676243+01
4e9aeba1-2424-459d-9a9f-42b529af7b5e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:14:49.753728+01
1a605687-ef55-4a1f-9c22-9654ab80d415	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:14:55.047456+01
93cb8b6f-d784-4b2b-959a-89ee4c479657	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:14:57.051312+01
42929403-2847-4d8b-bc22-467cb67e3356	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:14:59.048696+01
b97bf3ba-ed4a-414e-a9c3-5c5cbcf815d7	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:15:01.954735+01
8024b5dc-fa1c-45be-9785-2d431cfca9d1	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:16:38.876448+01
1ffaa8db-befa-4cc0-b80b-7fcb3107b062	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:16:38.958944+01
dc1ec275-25ac-4576-975f-623bca72e1a6	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:16:50.367144+01
ad53a3ab-171e-4fb3-9bc7-1d2262a9ed39	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:18:31.640029+01
e2ba0016-abce-40f9-ba1f-c5b6b62624bb	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:18:31.732668+01
f86041d1-23c0-4257-be4c-86b5024db576	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:18:35.158146+01
4169a611-0584-4a86-9cca-b95ad92c7a45	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:19:24.651536+01
600abc04-4075-4368-8ab9-780b36d5b2e8	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:19:26.225965+01
a80a32b5-d855-4079-8cef-2e270f71397e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:19:30.486658+01
7c603e38-97c0-4126-8048-90b817c46be3	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:19:30.578548+01
520a6148-a729-4ef7-bab1-cbf64e86e82f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:19:36.973469+01
070485a6-7ee8-4d86-a5d7-6f84d86f8bdf	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:20:08.329507+01
2618a1d5-ff6b-4d71-aa9b-9e7a6fca6e71	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:20:24.173573+01
f531b515-f195-4524-a508-9069fcf9c9bd	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:20:25.963733+01
f7750a5d-7691-4aec-8657-9313a6b84dc0	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:20:27.300473+01
069e3343-0ef2-42bc-b66d-cdeeafd51dd5	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:20:28.396775+01
4293243e-7732-41a7-a5e4-08d845dd3982	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:20:30.120414+01
a3401583-d163-4f75-98d1-6e77aa60365a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:20:36.837693+01
7580acc8-0360-480e-b8bd-1f5381299cca	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:20:45.349255+01
ff52c612-c849-4964-bbe1-d95b21e077a5	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:20:45.397344+01
616a4540-acf0-4b75-aebe-d4af06ff85fb	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:20:52.695362+01
ef9fab40-6f92-4e2a-bd9b-e354ce2223d7	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:20:52.79051+01
643b8a1d-82ad-4c9b-be1f-557cf9650e0f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:20:56.557341+01
b93cd270-9538-419d-a698-727aa2891e59	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:21:23.570614+01
71d1b194-0df7-4f5f-b95f-c48af13c33bc	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:21:23.670112+01
68eb7e9a-f365-414a-b338-b09820f5d565	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:21:32.009529+01
408f7991-3ec4-4a71-bb05-5a81e48960ee	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:21:42.979504+01
2ccfa371-e094-4b52-b611-5d6911efb9ef	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:21:43.303271+01
5ba2a394-c07b-4f95-80cb-b4a04859b33c	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:22:18.964273+01
21e51dfe-6e1d-4c43-90b6-a2bb967a53a9	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:22:19.012884+01
92690671-cada-4fef-97ff-83a71ae65269	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 0}	2026-01-08 17:22:25.881464+01
a9660c0b-3457-45fb-98fe-58bc2d82b3c3	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:22:25.939653+01
f6c6b5f2-95ad-4e1d-be57-9f8fd69e86a7	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:22:29.902574+01
6ea956d2-0ac4-4f9e-800f-5bafade397c7	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:22:56.065141+01
2a967c1d-04e3-4870-8f0c-65b91551938d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:22:56.194403+01
ca960dfb-d1f9-4688-b0b6-c8e00e5cfb59	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:23:01.985038+01
80f78cf4-3c68-47c4-91eb-8bbf828759cd	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:23:02.009433+01
40204abe-860e-4a92-bf92-22dab3dd423b	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:23:10.033172+01
6325becf-f4ee-40b5-8481-328e165be276	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:23:10.045043+01
161ebc1e-bb26-4a71-8733-70f6013eecf2	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:23:16.838489+01
7853db1f-e4f3-4d90-a7ef-c569fe966bac	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:23:16.850262+01
7d967aa5-a470-4a99-9a64-2366e5492a9f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:23:57.795535+01
a2ad6dcc-5588-4c42-8b0a-cbbb0572a8bd	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:23:57.820615+01
51b95360-54a8-4227-b583-67e9b0345973	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:24:05.438795+01
68116858-0c91-4ec8-9332-e3421d8f0bc3	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:24:06.567509+01
c7752455-42e8-41a4-9db1-01d1ee837081	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:24:07.349102+01
9f4c516d-2a28-472c-9132-0569fce32b9f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:24:09.93198+01
f372b81c-4936-4796-9ee6-22230f87d993	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:24:10.739456+01
ba8d89fc-29c5-4830-9a40-32d8a710bdff	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:24:11.281208+01
afb00388-c4c9-4f28-9116-d555a9ca6002	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:24:27.576584+01
286e8523-0ace-4d7e-a61c-6511d5e57f7e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:24:27.634281+01
00698785-4681-46b0-afa0-3eb168a1bc04	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:24:29.855055+01
e3532dd2-d0cb-4342-a76d-cf2d6d941a4e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:24:33.868962+01
73ba8887-5837-4ab2-86bd-ff8c21638e4d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:24:48.453696+01
805bad2f-0f5c-49a2-aa04-5608282b844b	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:24:48.479079+01
7feb56ad-8144-49e0-8a0d-6064efe9767c	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:24:49.871148+01
528e520b-c449-46dd-ae01-ea6397bbc6fa	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:24:53.894787+01
db120301-1f7d-43f0-b290-598e284ce494	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:25:00.483989+01
278b7852-bbb2-4aa6-b6aa-687093c33b5d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:25:00.550171+01
f08a0fc2-5711-4df4-8dd7-c6cd0285a977	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:25:05.117185+01
d53e8eb2-aff9-4146-b742-585921f5796d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:25:10.689096+01
53345583-fdfd-4815-af75-b059f95f2d6e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:25:14.214309+01
c353e5e1-3c33-4834-90c2-71be86d95f07	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:25:18.29254+01
56ca021b-d71f-431b-a7a2-53a36386432c	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:25:18.950393+01
aacfcd98-a60b-4ecf-9537-7cfa4ae35a74	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:25:19.270012+01
cd055140-efb1-4738-8dab-d00a4aa14a49	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:25:20.476864+01
926337eb-b090-4075-9a59-166c71b73053	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:25:20.709485+01
ffe9f7bc-eac1-478a-9327-14149c54e714	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:25:26.398062+01
0e78fb22-9d8f-41ec-b2c1-5dd569ead167	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:25:32.835219+01
5f896b5f-76c1-4ced-8a7f-306b11629c66	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:25:34.225921+01
286c4deb-0aa1-40a3-8199-23b15ffe397c	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:25:34.998552+01
0f71fd3b-f6e8-498b-86d7-9ba279592e51	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:25:35.788213+01
16751012-03a9-4432-9ba6-46c7a6cf6ddd	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:25:37.426814+01
bea42707-663f-4191-beb1-66e5d0fba3d0	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:25:37.444059+01
78f30bd7-71ce-409f-9645-c869942c3719	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:25:37.913722+01
256e2872-8a2f-4ff9-a0a1-eaba49a9798b	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:26:29.796623+01
d4579ca0-2e3c-4d07-9033-68ea4019fd67	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:26:32.705314+01
beedda3f-fc3a-47a6-b082-2d8a5cff9c38	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:26:35.364509+01
a7e5fef3-dc02-4ad0-a27a-2b7286169349	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:26:37.11212+01
4c050f0f-4ff0-47a5-8dde-eb5358b33391	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:26:38.332055+01
87ae2fee-2690-4f16-8916-32b4ae9cc07d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:26:43.746354+01
5a63b258-a1b5-4ae1-ae79-60a9fd512ad0	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:26:47.188204+01
30af842d-c3aa-4d1c-953b-c817d300e404	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:26:48.565329+01
bf8f2f7d-33e1-427c-82be-813277110d52	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:27:14.429859+01
2c3d35ec-baf0-4fde-b876-543fcf3eb2b5	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:27:15.545368+01
4f46d9b8-a20f-442b-b910-8a426039c2ca	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:27:20.569976+01
c5523502-b704-429e-92b2-28a74a86fcc2	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:27:23.69484+01
4581662e-5c32-4b87-b90d-f0fa3b72a2a6	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:27:27.787442+01
c497fe51-fcc5-4dcd-b2da-c3f2fd5f9b90	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:27:45.456012+01
9ae36afb-2c24-4561-8df7-9660da1b8301	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:27:47.496068+01
4edf604e-dfef-432a-b5f2-7582a5eb5d3a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:27:56.90323+01
6d6c861a-d179-4ff4-8dd0-3fcfbd28f872	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:28:09.179627+01
fa75640d-f631-4a0c-a93d-c46300abfdc5	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:28:12.78025+01
59d8e82d-5257-4df1-bf3c-476104245cbb	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:28:20.205226+01
d395adf8-0332-42d9-895e-dcef6c68634b	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:28:23.579341+01
dbc1ff47-efeb-4f4a-9d5f-34560f3ec51c	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:28:23.786974+01
ce56d4e6-f726-4d97-9504-673dbf5b030b	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:28:32.902688+01
4d5100ae-a68c-4df8-b439-1dd17025a751	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:28:36.457807+01
89c68dff-2de0-45ad-bbd2-e0dd702da35a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:28:38.491078+01
ae8597b0-61eb-47b2-85a1-cca7c6c98dc7	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:28:52.899982+01
d6f46b2a-f646-4c43-bd71-305b0da739ee	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:28:57.663432+01
1a5f8338-105e-41cb-a691-c8ceedc4b253	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:28:59.02976+01
c5b468f1-5385-4dab-9035-1db5c08f9d5e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:29:00.390119+01
dc0bda74-8e2f-4297-8ed1-913e2e2b5f57	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:29:01.348205+01
f40a9ff1-c7ef-448c-a0cc-992827d09414	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:29:02.55491+01
349dd3dc-c8d0-4b16-96b0-4bdd4cb2b37c	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:29:03.856514+01
cc045b71-2acf-4512-a636-c57b6eb8f2a4	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:29:12.42968+01
e8746ee4-3474-4614-b82e-c8b4db7e4242	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:29:17.280231+01
a567e248-008f-461d-81f6-e0d60adddfd1	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:29:20.946309+01
cc03ade7-55b3-44e9-898c-471e695e6e11	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:29:26.684997+01
b2b4d6d2-2de6-458d-ad82-e44431c58a81	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:29:29.82725+01
83138a43-331d-4f37-92b7-2ced5d282362	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:29:32.570521+01
31679ab9-9e6d-4846-95e5-affe642d4b05	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:29:44.019383+01
82e510da-1764-4055-8126-36983b9ff933	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:29:45.510686+01
1562722c-0ef9-4b25-8b8c-f24b20dbced6	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 17:29:46.44235+01
663b05bf-cccb-47ab-bd4d-2679aa1db93f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:26:04.214027+01
eeb40dad-92dc-4e4c-8977-5b6748d8d051	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:26:04.267143+01
18f23412-a0ae-42b9-abbb-becbb5a2a5ad	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:26:09.679243+01
a7a997d8-ada7-4dc1-a5ce-1bbbcc429015	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:26:11.368615+01
0a44d1db-8854-4772-ac6f-30427ca7a9ab	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:26:57.167208+01
c434bf2b-c8aa-42ac-8801-0b3c4733ff64	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:26:57.200169+01
730da0d6-2d46-4530-97f8-a5cb14277b29	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:26:58.420338+01
954fc16b-1740-4e93-93ee-5173289c3d47	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:27:07.996226+01
1763c8b4-1334-43d3-badb-0012b6a943a8	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:27:10.19578+01
81990de6-ff25-4976-bae4-6e6f6da7a9b9	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:27:10.581644+01
b48fb920-371c-4ff8-aea3-4b70d128efe4	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 0}	2026-01-08 20:27:33.472362+01
e9e56ca4-172b-47e3-8af2-ac25d2ae92de	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:27:33.587831+01
a1bbf034-b4a2-44a2-9ea3-91a7c0328115	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:27:34.948179+01
74bec061-5733-48a4-8569-e10d774ac03c	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:27:35.853897+01
b13c838a-34cd-4a89-8de6-0e0407b664d1	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:29:51.988217+01
e0dae95c-2542-4660-898d-bbd45f3cccb9	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:29:52.020881+01
fc0a6864-172c-4759-9001-36e35914103c	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:29:55.696589+01
7e00d86c-559d-47e9-944b-eabd559a87e7	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:29:57.725831+01
3858cf0f-98b9-4cb0-8c6d-709e829afb0a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:29:57.936839+01
3444e5f1-1012-450a-82d1-2ff7e6878c86	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:29:58.877803+01
1f2edaa2-ed2f-487b-a76d-c18439b65659	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:30:00.677163+01
2b9a8e1d-f17c-4f0a-9e8b-7bfcd5095351	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:30:12.066018+01
4a00637f-d396-4f36-95b9-ac5966d9161f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:30:12.934904+01
a731a535-7f46-44cf-821d-0c0c17553253	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:30:13.159465+01
ee8bb120-774d-448c-9285-f1f7cab942dc	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:30:13.350638+01
41dd999d-c131-4d16-b0a9-380fc95dfc31	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:30:17.393755+01
15daf078-86f8-4bfd-8b19-4b5ff3bfe98e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:30:21.402433+01
6f453840-87fa-401a-a115-a5a18a0281f0	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:30:21.443352+01
55feff29-a8d6-4633-b5fb-6acb140428a7	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:30:23.859899+01
40bf59f9-67db-4653-bc2d-dc70b3119a85	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:30:25.809087+01
ee4f517e-ebf6-44d4-90b2-459d7ed433b4	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:32:29.988135+01
e2565462-850d-4447-9c04-18e4149ba10c	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:32:30.019857+01
f125341e-5927-41e6-a313-6ea4d89eb81e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:33:08.354867+01
eea73787-4a7d-4c52-885e-57c705498c4d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:33:08.379247+01
5aa57962-33a5-4acf-be93-163d3f45ad23	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:33:10.412794+01
22d686c3-e42a-489d-b3b7-e69d7bb592a7	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:33:10.762228+01
64121db0-e610-4afb-b353-128942661ac3	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:33:11.070059+01
514a7544-c0c0-4c28-8af2-e5b36ce5907e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:33:11.286367+01
f27a547e-ed94-4f5a-82b6-cf8f4de4c61a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:33:12.227301+01
afa997f5-1c6d-4fcf-ba7d-ca37502de2b6	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:33:12.367615+01
7fd90bd7-b88f-40cd-99a9-f8dc2899892f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:33:12.55867+01
afea3f6b-8d48-4ca5-b361-1390fe7c49a5	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:33:12.791589+01
73f576bc-ed64-4c55-9bfc-795fa18a6290	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:33:25.284453+01
07cb74ea-68cd-4c23-91ff-4eb69c0b4729	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:33:28.824487+01
f8c0be4e-714d-41bb-af89-000d72a23d98	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:33:29.56381+01
93386bad-30a4-41ef-b1ba-56f2a2d8d6a3	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:33:29.658558+01
ff289d8b-7e9a-45c7-ac9e-3db80f9feb02	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:33:29.858149+01
9d961afa-1382-4a92-871d-5545c003fd40	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:33:47.801817+01
0c4381c9-5044-40cd-9c90-7aaee05b054f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:33:52.599325+01
12bd5684-7f70-424d-a1d4-40dbefa68fd7	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:33:57.522282+01
06db3819-ff14-443f-9c66-76282b5a4732	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": false, "field_id": "temps_dev", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 20:34:24.691343+01
14cdbc2c-6ed6-47d2-95ce-1b9e790e2ced	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": false, "field_id": "rédac", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 20:34:26.439547+01
2689622d-2cf1-4dd3-9189-de591ad99182	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": false, "field_id": "rédac", "can_write": false, "can_delete": true, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 20:34:28.347219+01
3529cc22-a77b-4321-bbe9-27c22db0ac57	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": false, "field_id": "temps_dev", "can_write": false, "can_delete": true, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 20:34:28.800302+01
858e81c6-414b-4f42-9785-d0ffd0eb15fa	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": false, "field_id": "temps_dev", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 20:34:29.266543+01
38e697fe-dda4-4bea-b0a5-796877b79677	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": false, "field_id": "rédac", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 20:34:29.873498+01
e2f77a0e-9995-4eba-952b-e62ac7b3d61d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:34:32.983169+01
cc27bdb5-de15-420b-a597-c40dd70c3936	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:34:32.9977+01
a10ac8bd-5906-4a27-a35f-fa564cdf1957	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:34:46.67683+01
d3b5aaf7-e176-4fc8-a25a-3dc00fa14cc9	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:34:46.70487+01
7f469c80-9dff-488e-9289-6794e4bb8923	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "status", "can_write": false, "can_delete": true, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 20:34:55.464011+01
a7a7b30e-46ae-4265-9c00-15ab7b0a6998	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "url", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 20:35:04.669542+01
39d48f27-24c3-4767-a198-747085d4a80b	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:35:07.701316+01
703023a0-6b17-40a7-a200-43f53da2f1e5	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:35:07.713862+01
beda16a9-ec88-4157-993d-02bb82c15637	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:37:34.227627+01
ce01f903-ec3b-46f1-aec0-5dfb602965ee	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:37:34.435287+01
2d38cf2a-c1f6-4aca-ad56-a59c5c4a99a9	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:38:01.056111+01
2adba43c-1fc4-4585-95ad-a6effa40eaec	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:38:01.088844+01
84b02cc8-0a60-44e2-b1d5-4db78c32d593	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:38:42.524906+01
b89fd113-aeaa-4e98-a7eb-a4a8a6c0d5df	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:38:42.615974+01
17e6e13a-ba35-499e-a39d-5a904a49d785	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:39:04.770805+01
f5a55025-c035-4056-9f87-6d8cbfe81b67	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:39:04.802692+01
c00e0263-372b-405b-a6d1-1426934bf4a8	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:39:28.630004+01
e6f7c4a1-bfd8-468a-9f5b-f5e694e85a03	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:39:28.662727+01
a44be65d-f625-4d7a-9823-74e774b69e16	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:40:41.466737+01
0272749f-63b3-4745-b06d-1a6a393e1fcb	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:40:41.509601+01
aff08fdd-dc38-4885-88ca-3bb3ed41bdae	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:40:43.29145+01
df8f6e9d-a795-4754-b28d-12e42c37ba78	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:40:43.304203+01
da05b32b-ed87-41d7-8703-3198e7e48c7d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:40:51.912928+01
f9480878-1c34-4a6e-9a1d-a3686be7b04a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:40:52.695865+01
1861887a-11c7-41a3-9416-9e362ab6a58c	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:41:53.43161+01
8c7c3843-3f5f-44ae-839a-540a26fc5186	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:41:57.575063+01
08565283-9bdc-41ac-87ce-5e05e2caa4a1	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 0}	2026-01-08 20:42:16.424495+01
215d12a2-2ff5-482d-b311-a2e68a5b41ca	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:42:16.447962+01
6936fbd1-0a7b-4b36-9a45-5955e1ca8eff	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:42:18.863407+01
6cd0efb7-cfb6-45c1-932d-0c6910ef0dac	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:42:18.896014+01
20086858-9f2a-4dfa-bd3d-b9411efd5150	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:42:21.149293+01
29649823-606f-48a5-bb8b-d077d807449c	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:42:21.21099+01
d9b0270e-97cc-472e-a2e5-9e49e2b4a9e9	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:42:24.144453+01
96bc84b5-493f-4aed-8a79-b403f85ab3ee	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:42:24.161749+01
8eed54e3-c2bc-4588-b3af-d3e66043171b	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:42:44.058109+01
25261f10-caa1-410b-9389-810fed1a7171	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:42:46.286516+01
7a0750ca-bae5-42fc-9bfa-967701105c91	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:45:51.471518+01
1d0e63fa-a1d5-4e9f-b283-e6b273ac6ab1	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:46:41.112941+01
e6e947b7-996c-4c32-b9cf-1b382e69017a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:46:47.13602+01
cfc8e24b-1c97-4db6-b89c-9d581cf13b32	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:46:47.901668+01
93795424-812e-4f10-aaf7-db98e6d82c78	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:46:50.625992+01
edf902a1-5837-4410-b1cf-52aee20ac3d3	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:46:54.432928+01
731fe99e-077e-4045-b5dd-2b12eefe8c28	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:48:31.117911+01
e7f5ae1e-5cab-4ea6-b4f7-22b58136fd65	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:48:31.222407+01
e4cb34a5-5868-4494-9b68-45be72b61ab6	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:49:00.914196+01
643356ba-2e5e-4f15-a00a-07f5ab62d2a6	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:49:00.955511+01
10f9f8b1-a40a-4939-a118-9e6f41866f54	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:49:03.547006+01
2be9deb6-375e-4251-9f31-fa85f51c4f25	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:49:03.96207+01
0373fb1c-1c26-4f68-a73d-be3456a4b1ed	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:49:04.586532+01
374afddb-9f7c-4b76-9a6d-c6efb5725830	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:49:04.68608+01
39c71e0d-9745-48a3-9dbe-f0d5b39e1a94	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:49:07.008105+01
405b0af8-c828-4687-9e9a-d485377559ad	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:49:07.474301+01
bb9b54c9-7fd8-4388-aee9-54bcab207519	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:49:41.915759+01
f843e9f1-c0ff-4143-a2bf-c527d84148f1	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:49:42.423703+01
0a44df5d-5a9f-4fad-abc6-14ee65b27fc7	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:49:44.921649+01
ef64eb0f-425a-4117-aff8-c8f84f97f021	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:49:45.229711+01
3c306408-184b-468d-b957-f8a7512d7ad3	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:52:00.363482+01
c482dfaf-d6ee-4367-8012-89a15e17a52c	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:52:06.47335+01
d6b92932-bac9-434a-ac4d-522d7d5a7a25	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:52:12.223627+01
58134367-145b-449c-a3b8-3c262a6db7f0	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:52:15.279495+01
f0f8a408-9aab-4bf1-b4fd-b0c698163d90	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:52:16.726039+01
7f76f595-8608-4c7c-9b87-eff2871e059e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:52:17.241196+01
034f29ee-138c-44c3-9c5c-9b10ec34defd	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:56:29.762132+01
5ddfbe4d-4d75-482e-87bd-bbe430e7f3cd	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:56:39.567491+01
a9956dcb-e321-4200-a435-321d77dcda66	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:57:00.431471+01
2c1f3dfc-7444-4417-bdd4-140fafc706d4	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:57:04.788403+01
1109badd-a039-443a-a04a-4a2905793dd4	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:57:05.205628+01
7728abf4-dd86-4c9e-92b9-8a74ad32f9cd	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:58:43.887893+01
6f654e7d-5821-43cf-8a55-48bc76ba9ec1	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:58:43.91646+01
b6714f20-05a2-40f7-83a7-00d16ce7a793	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:58:58.165285+01
2feffbc3-9575-420a-a8f0-6f04d1f26cb1	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:58:58.214482+01
0bb76ec0-e359-483a-8c12-32521e8c0feb	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:59:30.192654+01
aaedfd3f-12c2-4cf1-8470-f087d892104c	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:59:37.557672+01
a425d72e-bfa4-4586-a0ae-e80f262fa910	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 20:59:42.968796+01
3c4f37b2-c87a-43e4-9029-afbfd545745d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:00:15.882883+01
9dfe5248-857a-49f4-9460-3170acb799dc	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:14:10.441697+01
41cffa5a-b059-43ae-bc06-67a60b033b9b	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:14:40.251657+01
ae5cd668-4a7c-4595-a799-7ce91460a1c4	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:14:40.275405+01
6fd1e38f-a90b-44f0-915d-7ee59870637c	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:15:15.828555+01
df86e4f8-fc71-4cfc-bd87-ad9bc44ed267	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:15:16.194807+01
a9b446df-5a38-4cfd-87ab-ddd657fb6f15	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:15:16.852087+01
a2b2b1d6-5174-4d5d-ad20-832e35a58d38	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:15:17.001591+01
67071445-3270-4463-ada9-1c96a63be725	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:15:17.608536+01
a5e72ca3-d6e8-4232-8ed2-5da3c3602479	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:15:18.7586+01
45ecd7cf-c161-4c82-ac8f-6b1cdd838089	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:15:20.707104+01
3ba813e7-6ef5-4596-8fa3-24f247677f10	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:15:22.131637+01
e6a3c8b0-5c7a-48e6-9f7f-d18ce41b34e8	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:15:24.863837+01
6f01d55b-11a6-4e01-87dc-7e46bc467329	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:15:30.468995+01
e54b3d5b-717c-4a27-9099-8b6721322ebb	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:15:31.560477+01
2acc55a5-e724-47f4-9ab1-197b7e8065ca	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:15:33.209632+01
4b55f320-bacd-409e-a1e9-6f033d013269	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:15:49.317887+01
6df1c5c7-ada1-4d13-b11f-f4cc6f313163	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:16:11.763129+01
8284c534-1f10-41bb-8c3f-5df411fb4b8e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:16:16.738231+01
a8966252-4855-4a7e-afff-4f55b04c8279	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:16:19.026082+01
506a1ea6-b1d3-4982-8bdc-4dfe3eaa43f7	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:16:22.733957+01
d51b6d71-ec1f-4440-b241-ffa84f461a90	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:16:22.750679+01
bb333ad4-5487-4281-9a00-c4c5592c8fe5	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:16:26.889537+01
ef522e05-7866-4434-8e43-d6dd67042370	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:16:33.820688+01
cd12a143-8634-449a-970c-633389e64b9e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:20:41.705533+01
0e68c400-c498-41cb-b0e1-464b0fe76a54	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:20:41.71738+01
b9e2d852-0402-457e-9dd6-5ea6be7c42ae	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:21:00.16289+01
cfae9a90-aa0c-44a4-93f5-87d696ad84b1	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:21:00.187658+01
7c1cffd5-5345-41fc-94e5-8e4d64ed6376	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:24:34.893673+01
99337f41-130a-45db-a71a-5dde2c3186fc	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:24:35.256852+01
e25bd68e-271d-4c57-806b-626a9e78fccb	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:24:36.039687+01
2c428c17-24ec-4387-b712-9890cda83393	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:24:36.85581+01
77a83540-5eda-48d2-ac16-c5f258e911ba	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:24:38.953801+01
fad97205-8dc6-4af9-96f0-c3574ff25829	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:24:38.966493+01
012621e1-247f-4a4c-bc16-a52faa388ec9	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:24:45.08498+01
362e4b26-7fb8-4411-b004-67cec87a5696	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:24:46.321208+01
10c1f5c1-97f6-4305-b1ac-b63053741076	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:24:46.864342+01
117c9c26-5eea-48c0-9a7f-75e5860daf29	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:24:46.897162+01
24673c14-4e90-4cb2-b42d-8342069d3cea	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:24:54.609111+01
2db0423a-4c87-45fa-99c9-fb5d162e9a1d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:24:59.599238+01
338f6f7d-756c-47b2-80f7-7a92852f267f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:25:16.214344+01
cde392c8-e5e3-4f4a-9b2f-cd56088cfd14	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:25:16.239268+01
c844c1df-6f6c-41e7-9413-384782f244c7	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:25:44.621712+01
88a4d6d3-9c91-4540-bfde-d800e7d88b36	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:25:44.646034+01
e3cd080f-f690-4ae8-9483-4163113e7181	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:25:46.371527+01
406ccc38-3393-46ee-b201-d29563f037fb	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:27:20.580747+01
f67d21df-31e4-4f2c-aad9-fd86d4c7c825	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:27:20.59258+01
42467241-d49e-441d-ac59-550b05267aca	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:27:42.099708+01
8151883e-443a-43b9-8bf8-fd5b2cfff145	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:27:42.122557+01
4681db44-c1ce-4128-abe1-a1b647baaeab	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:27:49.471025+01
19afa8b9-e196-4e7e-8993-d20cda881624	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:27:49.495133+01
3846bde3-fec3-49ce-9f19-2414c257de80	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:28:06.563478+01
d992d4ed-1cae-4481-8c84-04cb156dcec1	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:28:06.588263+01
854843bd-70e2-4e4e-9b68-ca9695434954	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:28:11.266042+01
cd7c0b83-4eac-4e8b-b3f3-80b83cb1cab5	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:28:11.290548+01
10ea2f41-7674-492f-899c-e2fb0169ab29	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:28:47.906291+01
df42adbb-16a5-4bb4-8096-b01f8f8fd413	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:28:50.828808+01
4dbb98b0-085d-48e9-85d2-a7175d95fbd9	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:30:39.569708+01
799ed188-a9fc-4afd-99d5-138a647770c4	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:30:44.349265+01
f9f1b185-ee5c-4797-86c7-b57593d83daa	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:30:45.456347+01
0a03c242-2956-4834-a900-b9fa010852e0	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:30:45.930476+01
bb2c82b4-1a7d-4df8-a79c-f5e4e33b4f52	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:30:49.204352+01
788ec65d-0014-4fdb-846b-3ad5b9f6d0b0	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:30:54.033543+01
c05afcfa-7837-4996-ba6e-680146980f7d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:31:18.539668+01
09704178-e9a3-49c6-a7cb-75f9c7363e1c	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:31:26.340246+01
f0715010-492f-46f2-9b2f-90392d05ea1c	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:31:29.937615+01
28193615-b444-46eb-ac19-058c3ce073dc	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:31:33.091433+01
1bd8eb02-5128-455c-a175-bb5321365335	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:31:45.198081+01
d0f1cf33-7e3e-4296-b938-5b7de0d49d4a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:31:48.455001+01
da6af7a8-5df6-4203-99f1-5436d3ad518a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:31:55.725649+01
9c153958-48e0-4cbe-8958-d63f10eb5899	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:32:28.1562+01
657a7356-5b30-48f1-9526-093298d4375e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:32:37.373461+01
9f91953a-1730-4768-ad94-5014de31d52c	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:32:52.436946+01
ff2f238f-451b-4af9-8231-1c00e5932dd3	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:32:54.656373+01
8944e89f-b2ba-4e83-bf48-33f9e3f09b41	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:32:55.815909+01
1dee8f74-5621-40af-9aa7-c134322af9b0	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:33:37.764137+01
894ea4d1-d4d3-4be8-a232-49b3b416018a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:33:37.799652+01
12a80730-c2de-4794-860d-d0ce28b89477	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:33:43.594344+01
b6fdcf76-bed5-4a8b-ba59-fc0ae83f3afc	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:33:50.886139+01
34039ce0-11d8-472b-9e28-861c33d915b3	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:33:53.243584+01
0150a742-851e-4c43-b9a3-ac00f3d36173	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:33:54.755552+01
0161ccfc-c9d6-411d-9a12-e36805faa67e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:33:55.113256+01
cd7556c0-5584-4648-a2c4-ed97a2a147c6	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:33:55.666184+01
6b12fd1e-1d08-41d0-b7f2-9680a7eb466e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:33:56.131969+01
f7d643c3-40c2-45ae-ae6b-67f8b0883a80	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:33:59.77043+01
9547dcd5-3525-4579-9b02-4583e2313501	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:34:01.252313+01
2a6d977d-ffd8-4661-aeeb-0d3244800867	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:34:01.751741+01
172da8e0-f525-43d1-bbe4-5e6ddc4a7ac5	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:34:02.101254+01
d0cc7f0c-316b-4cd8-92fb-77c066313963	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:34:24.83593+01
b5b2749c-669d-46e4-ad47-ef933ac7245c	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:34:27.196019+01
af027280-0d8d-4793-bb84-5ac7fd5b4443	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:34:29.344454+01
92173e6f-ba6f-4f84-9567-ab4d720b5442	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:34:31.326931+01
9ecd625a-d1da-483d-88a7-9754578039cf	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:34:32.318152+01
b47b2f29-6e9a-411e-8928-da39e174dae7	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:34:47.017592+01
93f75405-d73b-4a25-9bc2-b8c407e10146	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:34:56.906445+01
cc372949-6959-4976-b7ab-eeea066dd3b9	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:35:00.294106+01
9b8feae6-5d84-4b77-8b05-c748a1d513a2	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:35:04.012603+01
d994d5fd-a120-4dfc-a6ed-ffbbe48d5db2	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:35:07.596716+01
60f2dd97-549c-4a16-a3ab-ab947fe08d98	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:35:08.528636+01
815ed9e1-ee51-4f24-99f8-d4a7b222cd00	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:35:12.203179+01
2b1669bc-a31a-450f-8b7e-b677605bef25	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:35:12.227659+01
0e9e6e70-8b35-4da2-95d5-d75a07f84ceb	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:35:24.568192+01
b86304c3-4c63-47f0-98be-f7a723a02275	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:35:57.124903+01
d032f0c9-e22f-4e6b-94a5-07e39094a424	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:35:59.695012+01
2ce3adfa-d94a-4c30-82ab-ce580166c83a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:35:59.719412+01
3342f70d-e994-4b82-9cad-de76f3af9259	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:36:05.173675+01
73cf86e5-d856-41da-bdda-a270a8c5ba57	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:36:07.132043+01
683765e3-ac84-406f-ad68-a4df9d3035ee	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:36:11.989842+01
f60bffba-255c-43cd-bf21-43f57635e93a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:36:15.065806+01
d18fdd7a-cd79-4fe5-bff5-ad633f1aa503	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:36:16.739812+01
16c466ca-b2db-4deb-81ee-3583981b5e5b	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:36:18.61283+01
b1419ff6-8b4a-4399-9865-2e64c210c989	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:36:22.218262+01
19d70db2-7805-4566-9d7b-f62a5ee27be5	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:36:05.186983+01
a55ed5ba-6fa4-4bbd-97b2-77c7cb1acc39	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:36:07.155536+01
bae4fa74-1585-4467-98b0-fbc3b3d88924	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:36:12.014071+01
4e433337-2d16-45c2-90d7-8b8b5d0ee548	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:36:15.078414+01
31c97446-fb69-4e64-bb3f-61b3a8007fb5	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:36:16.764098+01
a5031f70-8d4d-4423-8108-f158eab5486f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:36:18.636755+01
8bb13c49-2c78-4e34-bab5-80fe0ab14dea	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:36:22.22774+01
ce51c02f-1d2e-42b9-b8c2-09523a74823d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:36:46.334257+01
9a124853-aba3-4ca9-b020-376838949bc3	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:36:46.345136+01
a9fb5ab4-36bf-4f20-9043-39414a341e20	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:36:55.864485+01
5625c6d8-32b8-47a4-a7f5-a0fb0c67adef	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:36:55.896886+01
31f34bae-e42e-4f93-bfbd-7abd63d590e1	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "sites_lié", "can_write": false, "can_delete": false, "collection_id": "companies", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 21:37:22.986817+01
f9ad7006-17bb-43db-b91a-df980c9b3b8b	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "sites_lié", "can_write": true, "can_delete": false, "collection_id": "companies", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 21:37:23.59111+01
c213d5a1-4bf8-4571-a2a5-93263d5d179b	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "sites_lié", "can_write": true, "can_delete": true, "collection_id": "companies", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 21:37:24.857337+01
29ed1af2-b137-4fb7-944d-edb59643db6e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "temps_dev", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 21:37:29.962934+01
29ccf05c-3dc3-4069-9c85-fd8d6e6a22e0	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "rédac", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": true, "can_manage_fields": true, "can_manage_permissions": false}	2026-01-08 21:37:30.434857+01
21cf796a-3f0f-4c8b-b323-449c38b82a1c	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "entreprise", "can_write": false, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 21:37:36.804302+01
52d3f92b-68b8-4ee7-9bb6-1b799b8beb72	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "entreprise", "can_write": true, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 21:37:38.462351+01
dc92e868-b535-49a4-b150-59cc86a4d63a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "entreprise", "can_write": true, "can_delete": true, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 21:37:39.870594+01
2db65fc3-a805-46db-8b55-ff0a87b8d023	cedba177-5aa6-4d81-82d6-f09aecb47dfe	permission.upsert	permission	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	{"item_id": null, "role_id": "b8c5cb21-e698-45e7-bbfb-6aeca891af0e", "can_read": true, "field_id": "entreprise", "can_write": true, "can_delete": false, "collection_id": "sites", "can_manage_views": false, "can_manage_fields": false, "can_manage_permissions": false}	2026-01-08 21:37:42.277738+01
b30c2e86-20d4-4701-a257-8500605a6ee8	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:37:51.277125+01
e124f95a-9f13-401a-9307-8849185a5cb4	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:37:51.291751+01
acb62f36-5eb4-40f7-aa1b-ad3c2ee62b8e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:37:57.576892+01
382577be-dde9-4db9-a1de-a10012df7b0c	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:38:05.127388+01
1a087b79-1052-4a1b-b915-16e4e1cd8081	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:38:11.523159+01
c419ec9c-f51d-42fa-ad64-2032190a509b	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:38:26.917862+01
93df93ee-1a0d-4dc0-a81d-757426672c42	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:38:33.147032+01
21ea01bd-d916-47ff-a8f6-19166c07b02f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:38:35.454026+01
44fb7ac8-18e4-40c6-864e-6753b87ef293	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:38:35.471556+01
49c6b643-c852-4bb5-89fb-a4b43dd3c9aa	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:38:35.766027+01
7ef0f819-d7ad-4c5b-adde-4876dfdf8e3a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:43:30.079361+01
f3d05687-a097-446e-b908-6dbf649fea13	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:43:30.091164+01
616d8ca5-cad5-4179-8f58-0a40275b4056	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:43:42.537347+01
d04733f4-d71c-4e26-80c9-2567e8ebef9a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:43:45.811239+01
eccff072-8889-4760-bd82-d3cacc2c02d7	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:44:01.016294+01
c2988fa1-bed1-402c-992b-9e5fc830c4b4	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:44:06.445117+01
767d07eb-17ae-4384-9269-e6351905b13f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:44:14.911722+01
401ad531-3bdc-485e-9ce8-6153b296cd40	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:44:14.936272+01
873da31a-e1f7-4515-9ab8-f35c501dcd2d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:44:19.463958+01
c4b24dbc-3491-400e-9b9c-a03504c22888	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:44:19.487336+01
d0afb497-5400-462f-babc-f6cc648e50c5	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:44:37.383256+01
e8b0a8f5-9134-49b3-8419-a42e92ab222b	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:45:02.056389+01
a07b07cc-d1c6-4112-aa10-cb63c877a713	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:45:10.01896+01
283bf149-27eb-46f4-8d2b-6fa3b6d34d31	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 0}	2026-01-08 21:45:19.554564+01
f18940a1-b69d-4f1b-b401-f995f42373fd	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:45:19.587721+01
4d73a3f3-02ad-49cd-8b11-0832daacb89f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:45:21.357212+01
485b2d95-13f6-44f7-a0c0-a4b1c2b8d438	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:45:21.406615+01
fdaa0778-3519-4adb-b835-27d15145e78d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:45:26.245648+01
ccf8874d-0f6b-4131-a84c-0eb9acdeb658	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:45:28.279396+01
4d4c8ef6-72ca-46e2-b3bb-5fd924e15769	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:47:02.798834+01
992f694e-dd6e-488b-8ea9-c3b76dafac93	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:47:02.823225+01
39b3c2ed-2ddb-46ce-8ea5-72a46f5b046f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:47:11.339695+01
838c6517-7b68-465e-a150-dc5f03acbcbb	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:47:11.358805+01
2ed59687-0d1d-45c9-982b-a41aae81470b	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:47:43.696041+01
21404aa7-d92a-4774-b2f5-895787762519	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:47:43.719426+01
243d20fb-2e47-4e76-aabb-56b5a96717d2	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:48:29.237869+01
1e94f5cf-ff7f-4855-a732-ce1fab5092b3	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:48:38.69484+01
f70bc34b-0a73-4df5-88fd-ad11148e70f3	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:49:05.339993+01
f8a7c6c8-45b9-40c6-96fd-a39b46e50c49	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:49:43.286568+01
57543e27-af3a-445c-b45c-2466a3686ef1	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:50:05.227364+01
ef6f6a2e-55d1-46ab-8a8d-52f58f5a4c50	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:50:13.36883+01
16a7a1f4-4d00-40bc-bb08-2550ced91d1b	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:59:37.938445+01
2ed0d9ac-7b80-4ef5-b2a0-57df14e4dad8	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:59:42.168585+01
c884f9e8-ae0f-4e56-bfb9-4b8e7fe5b448	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:59:49.36085+01
6e64e974-b169-471e-b0ef-5baa2b1108cb	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:59:52.921284+01
4791f2aa-176b-433f-8534-71a45380d63f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:59:57.153088+01
e4d7ac25-f7ae-4f9f-a47a-33b8ebd50563	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 21:59:57.837341+01
9d2797a9-a53d-43c2-8c9e-a6ec823869a5	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:00:01.898591+01
73149074-eb65-4f2f-a596-f031d6b20049	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:00:02.263593+01
18a0501c-40dc-41c7-ae34-339f4dd3d3cf	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:00:08.082665+01
7f8a2806-56f6-432e-aea0-6488cee9db52	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:00:09.922733+01
44f32f7c-c5be-4080-89ef-d05575170b4e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:00:44.359492+01
6eb70002-18bf-4c30-b09a-10090ebd676b	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:00:47.733512+01
f3ecfa57-4a42-40e8-81ef-b0e21556bac2	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:00:47.74606+01
035f6873-d387-4da8-a9db-c8098777c75a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:01:00.284813+01
85e0d6fc-e46f-439a-8a69-603b4f4d18e1	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:01:00.5996+01
1f5c47cf-af69-4dea-a494-59f91f966b25	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:01:01.502323+01
95e8920c-ff60-4eb8-b3d0-9c1767b30813	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:01:07.580957+01
aef59a81-a9cf-4801-8abc-e4691b141d57	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:01:10.941582+01
608f5fc4-eac0-4195-9d46-c32ac20400c1	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:01:13.18664+01
2f69a2ae-e1b7-4d99-8e89-d439ceac829a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:01:22.744394+01
e5b4db54-248d-433d-98eb-2f316365eaa9	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:02:09.489072+01
feed8996-e9ea-4c5a-923b-36b070b8c306	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:02:14.15906+01
d5534326-f033-4a1d-bfdc-d05cbea72091	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:02:14.332771+01
836cc3d5-8f39-4e48-80c2-e274a7c70471	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:02:18.089897+01
7e746485-6c36-40fa-a15c-5519e808d6a8	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:02:20.582103+01
0305f41d-f78f-4369-b104-3ca12104d4c1	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:02:22.501034+01
96dc94c3-392a-45b0-809f-089cd133d957	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:02:24.467144+01
8c027211-2997-43bd-a050-3038930c1e45	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:02:31.770354+01
4bbe8e01-6062-48dc-bdee-831a96d8aeb5	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:02:37.699716+01
dd7efe40-8724-4786-8ed9-4c0b4c9f03e9	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:02:45.856019+01
22755db5-267b-471b-9efd-1eccb59006df	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:02:48.001512+01
e2ba67cf-5a5a-4d66-8414-22065b7aff02	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:02:52.384012+01
57e5b6c0-167a-4103-9149-820bd2b4c2bb	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:07:53.488823+01
475deeb5-ceee-4400-a6d9-0238ae06d045	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:07:53.628605+01
be2edd39-ea5a-4c26-afb0-f8ad38a9aba1	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:08:15.609842+01
42707204-b0d9-4461-ad5f-541679cd5375	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:08:15.65115+01
0baed531-f578-463c-8d51-103fabf9a8ba	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:08:25.409647+01
59c38418-a70c-47f5-9995-3918423c29b4	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:08:27.866112+01
6058df1d-4847-413f-a7c3-edd470a71be9	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:08:30.218548+01
f4975fa1-1a78-455e-a6a6-782bc36ca7b5	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:08:33.459253+01
8c5fd253-2f17-4c5f-ad78-5a4db3de6dcb	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:08:35.198921+01
5dd910ab-73f7-46ed-a080-6949e9fce85c	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:08:36.177243+01
2bcc4bb7-13bc-4689-895c-7894c695bad7	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:08:40.758789+01
2446291f-d688-480c-9f25-84f6f4662a90	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:08:49.775274+01
d97218c7-12d3-467d-8f3b-52416711c87a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:09:05.859656+01
7736cc40-aa04-4dbf-8211-f003902e5669	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:09:08.195322+01
81cf33af-38e9-4be0-a74e-9fa9dabae988	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:09:11.688563+01
c2d5d0fb-c096-4f6a-b850-9d5e967cc106	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:09:20.888772+01
1bdd8a19-4329-4ec2-abcd-5059425fbe87	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:09:34.895306+01
78df0b2f-c612-4669-b5e9-04aa5e5503eb	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:09:35.533609+01
fc7fd579-67a5-43e8-9a31-7b22a63ec37d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:09:46.984555+01
7d26cf81-07a1-4f98-a968-46bdd8ed01c2	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:09:51.955225+01
282176ab-cd39-4203-a93d-d48d3b8df944	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:10:02.49446+01
5d380fd8-be2c-4274-839b-e4ee00341daa	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:10:03.142919+01
f1067be6-7091-4961-8df3-558a35206e63	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:10:11.273376+01
0ce54d73-424c-4fe4-b1ec-6475ffcb2e55	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:10:14.076195+01
4bda020f-3ae5-4108-b417-557d3e59afd7	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:10:21.147329+01
76d245b1-33f6-4331-88e0-f6b037c239b1	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:10:22.824549+01
e022f3a7-799d-4b12-8010-b8b863b97834	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:10:30.773836+01
5c81121f-bb7e-4f5d-a712-cc9f7400e0d0	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:10:32.819571+01
98cab28a-568d-4f0c-aca2-e5ca76ac67fb	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:10:37.411386+01
e2a255e2-0053-4a29-9b71-11948995fd74	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:11:00.243347+01
527e8098-f432-41c5-b7c0-4602d3a8acbf	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:11:05.40198+01
c89edffd-4642-40d2-a0f8-75aacd342aac	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:11:07.962066+01
65457c73-9c57-492e-b25c-cfc89f786e10	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:11:09.176985+01
1479b593-ebb8-4239-931e-85fee2867944	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:11:23.980798+01
4399b5d0-81d2-4f9f-ae76-72a88d0b8c38	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:11:29.851889+01
a1f18a1c-3b5b-46e9-bc90-8f1a9990842d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:11:41.92573+01
ac4bea1d-01d0-459b-a60a-21a140f54bec	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:12:15.013367+01
b55e4f2f-0b16-47a9-89e0-29ec96be80e8	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:12:16.731038+01
eb7d1efc-4707-400a-ac40-278d530e2438	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:12:18.211112+01
616ff58c-dcab-4035-bc9f-2d8bb60932f5	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:12:19.48113+01
f38a03e1-4fcf-45b6-a5d9-8b9cc2a2a993	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:12:20.178257+01
245739d9-f1f1-475f-8974-e3a2df1ac5bb	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:12:21.146787+01
1b8262a5-6316-4193-9879-0e1bcc10a703	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:12:22.604091+01
c6250b4c-1ad1-4c51-bfe0-c80c5cbab984	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:12:24.280872+01
8b6d023f-349b-4c52-856e-46d5923e5ea5	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:12:44.879032+01
040580e8-bdd7-4d8d-8db9-8fa3167389d5	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:14:51.08691+01
e07695ab-cae6-41f6-981c-793ececd1be0	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:14:51.099211+01
f15c6bbf-57ad-4d67-ab34-f2387301afbc	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:22:33.640776+01
d6a1371a-58b1-41a8-9d7f-869b9535a71e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:22:34.836636+01
ef712c1b-35c6-4248-9992-a8378ecce803	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:22:35.335907+01
74bf7e78-b100-4b5c-afc2-5afe5b7f6109	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:22:35.743803+01
046b8b35-7f0a-40e8-9d6c-7e118c5e764d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:22:36.108935+01
265f77a8-2dcd-47cd-8dcc-c973f46620ed	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:22:38.998484+01
07206293-a285-426e-b0ac-e53f978f2374	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:22:55.241857+01
c571ce8b-ddab-46c2-a0a9-764614b0bf46	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:23:22.490605+01
4f50d89f-7acb-4fde-a3c3-f7bba853b296	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:23:32.427116+01
b82838bf-d72e-42a8-8310-89f00220cfb3	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:25:04.145721+01
9c48bab9-3306-437f-8a0c-34eb9041d279	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:25:21.247356+01
97a68c39-9695-4a54-be86-cf6dc12ca3ee	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:25:22.615104+01
0619dc64-bbd3-44b1-bfeb-ce16d561e88b	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:25:27.815132+01
ac396bb4-aa42-4f54-905a-8fda4ff6ab20	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:25:29.28405+01
1a9aa482-b7b0-46e0-8d72-74037d420380	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:25:39.521873+01
004d117b-7269-4bd8-b772-2d41e06603e6	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:25:40.023896+01
50ddbf83-4035-427b-b7e9-cf9b50cc2b52	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:25:40.897999+01
072fbc71-0936-4704-ac52-91211cff4417	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:25:43.337841+01
b18bd981-9a19-46ea-b110-7003af3f3db2	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:25:44.192289+01
6b1c11b4-f8f2-4bca-bc3a-79d95877f3fe	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:25:57.079946+01
52267efb-737a-4d19-8900-43312717c05f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:25:57.121186+01
6831d145-ebd1-40c9-aac2-611496002086	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:26:22.267539+01
28f3e5c8-5e02-48bf-8f4e-4ad735ec05d4	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:27:21.2753+01
fb576651-6d7f-4fcd-894a-c858f948b78e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:27:32.634251+01
75b5f166-541f-4283-a72e-9e68d699d5ab	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:27:34.678757+01
e7d3bb30-e876-432c-aa05-5271417284ab	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:27:41.661261+01
768a8764-d429-4b1e-aa39-e039705a18e2	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:29:36.667433+01
a44eb854-9d92-4ac9-b557-3ebffaa631b2	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:29:36.6784+01
d1f4305e-0fcd-4483-b5c9-d4d7b8831c00	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:29:48.12406+01
11cb7752-89de-4624-b8d8-136a67034cd1	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:29:48.436471+01
f04f96ae-88f2-4eca-950c-0005a50647ed	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:29:58.623275+01
38139378-543e-4e83-8094-9ac6e18807f0	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:33:08.968889+01
b84f611e-0f91-4b2e-a8be-afabd1b35838	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:33:08.992267+01
ae1565fe-e21a-4842-888c-37414bed982a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:33:12.334881+01
aabb8f1d-9b4a-47a6-b212-4e2463a8c8cb	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:33:12.359428+01
4294931b-99fa-49f8-a331-5f7750e4aff3	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:34:02.099679+01
40f086da-5d24-486d-ae6f-c2924670a1e8	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:34:03.79714+01
79edacba-077f-4bfd-b3b3-a019b5a76db2	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:34:04.450868+01
fc7a60b5-396b-4c0f-a202-4f754df7aad9	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:34:07.64341+01
19be26e8-195b-4477-953c-c65783df1f6c	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:34:07.657813+01
b654587e-781e-40de-98fa-d1a3a1330359	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:34:08.278319+01
0aaaed77-96b6-45d9-bbdc-bfa2a92d1f94	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:34:11.894934+01
79d9b62f-a1df-4a29-8f09-5b4c40cbcb03	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:34:14.72565+01
f4e30ad8-7721-471a-88f1-c8cdf106ecfe	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:34:15.08077+01
3a1dd5db-b0bd-4449-8734-3845c6c77cf0	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:35:12.214059+01
1b6bec35-9b9f-4bfe-b8b4-eab8967b55dc	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:35:12.235257+01
1d977955-5cb2-4e6e-abd3-97e41e7650fb	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:35:18.928471+01
215a4c4a-f0e7-4cec-8311-44e76cb2f0f0	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:35:20.814748+01
4bb64eee-95ed-4f56-929f-37aab0ab11e3	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:35:48.290177+01
fedabb18-dd6c-46ef-9f0a-86a8ffc6a861	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:35:50.131341+01
272461f6-ef1c-446f-88e4-03c90bc883ab	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:35:52.23876+01
b1abd0dd-5021-4543-b5b5-6814cff85733	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:36:17.402959+01
f28fcaed-908f-4c62-ab41-80c04ede1722	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:37:35.061338+01
0a67d9ac-dd04-4048-a31f-e78bec17c7e4	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:38:19.270215+01
739608dc-feb0-4803-9c8f-ad6fa182acbd	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:44:37.823614+01
a09279da-18b1-4f96-b102-168ee02a6649	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:44:40.739459+01
c5e2e04e-d7bb-46fa-9329-0d08cf86090a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:44:41.201323+01
006a86ed-047e-48c1-a968-a38450a26f5d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:44:53.654773+01
731a57b6-2ff9-49a0-b05f-8dea7d99a9a0	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:44:55.404053+01
806d0785-fa9d-4785-b2c1-74801d3eddc3	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:45:02.937833+01
428ab249-53c1-4d81-8009-fd8abcf07a41	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:46:09.907473+01
4de1a1d1-a917-4355-b868-95735ef8e2f7	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:47:33.745803+01
8fd60b87-ed15-4f43-aa0f-fad702dc8ec7	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:47:35.656228+01
053c246e-78f7-455f-b037-92f6e5fe5dfa	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:47:38.063557+01
e2f143e3-a7b1-4ba7-b381-5dcc98ef01ca	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:47:43.98142+01
99817473-19ce-47a2-8466-a0a64aa89a8c	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:47:44.140713+01
b9addd99-7213-479a-8fae-28165bef02a2	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:47:47.570192+01
8f2728bf-f897-4151-a11a-9663efa816ed	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:47:47.935406+01
b1405dbf-24be-432a-8303-e679105596af	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:47:48.976675+01
fcdcd085-f7ca-40ad-972a-ac80e70d4e20	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:47:55.16665+01
e71571a2-bc01-464d-8c2c-76e4f1a9e82d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:48:07.125106+01
1b19ec80-7416-42dc-94e3-5b180828ffab	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:48:11.258637+01
4e153e39-fad7-4386-9186-8956da53e58f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:48:11.716782+01
227e5dd3-ea6a-43d8-a404-1eea2295b1ee	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:48:13.173785+01
052d085e-35b6-41aa-90b9-e7a7525d6694	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:48:13.598118+01
2704d9f0-8a67-44d9-a410-bdf882ba0425	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:48:14.256077+01
686e5dc8-39a3-41c3-ba96-254437582b52	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:48:14.572408+01
ab3525b4-bcba-4d64-8851-ec188da2d2b1	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:48:15.155275+01
ae5f1d60-59b7-4617-a9eb-9455679b6bdd	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:48:16.020597+01
c85c50f3-e89f-42ed-a3c9-663aefeb1200	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:48:18.977561+01
9e7eb326-f90c-4d36-aadf-b42e95e74699	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:48:20.54367+01
e9093cb7-1bf2-4292-b49e-a1aa4d7255b3	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:48:24.061459+01
08d2e12c-b894-421a-8f08-04f5c255bbad	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:48:24.56026+01
428cff7c-4ef3-47f0-b4a0-07fd68f21496	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:48:25.359726+01
30382c06-1891-4dc2-80cc-8244cef67135	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:48:26.292614+01
82a202df-b63b-4b4a-bf5e-c4f7448a5e13	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:48:26.758254+01
7b39d7e0-2837-4a25-88b6-ba0bd26bac29	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:48:27.082849+01
1c606369-f70d-4db2-8dd5-7c522c3b4ee9	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:48:28.222935+01
bd1ae777-b947-4566-8734-2eb4077231fa	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:50:46.598791+01
6a615ecb-0055-418e-81e7-97e1c94b4ce6	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:50:59.284095+01
2c014991-bba1-4ebf-8b7f-ef14db66fd80	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:51:00.28372+01
d8ee2b18-506a-493b-b524-c643c89274a3	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:51:01.891943+01
7c378e31-a553-426c-915f-3d8b5e8cb397	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:51:06.448064+01
d675190a-87ce-4574-a33b-1be18d837fa3	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:51:06.778355+01
d8abd2f8-af47-4b20-8182-ec084f392a24	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:51:07.286099+01
c5a38a25-1dfe-4d60-957a-51f1bee585d6	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:51:11.412404+01
6441be92-8216-41d9-977b-7d7bfb498bb7	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:51:11.886904+01
d25b6283-7ff9-4994-9566-9e0cad29d666	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:51:12.318762+01
f39662a6-fee7-4cd9-9dd5-0b950fbcda42	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:51:12.73488+01
4e17b9bf-5aec-427f-8e74-f3b32e217eb4	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:51:50.864769+01
cc56adc3-da71-45bf-ac3a-6caebc80aff3	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:51:51.488382+01
5011d0ac-15c6-4873-8557-165107ca9ba5	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:51:52.279637+01
c4acafd3-cf55-4e5f-b8e3-9c89acb7c187	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:51:56.611786+01
d887d135-b291-46c0-baf4-0f9e8510b42a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:51:57.1363+01
a023bfc7-29d3-4252-8fb8-fff6cbbeb6c5	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:52:00.872372+01
195feb58-865d-484c-a540-e0b1ccd2ed95	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:52:01.254097+01
c82b07e4-e1ae-4526-9fa4-2bb21a705cc6	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:52:01.620235+01
c083b834-e3c4-474e-a6ec-b1a49862ecf9	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:52:01.978062+01
97130817-a5ae-48bc-aa91-055fb44b9dba	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:52:02.519369+01
dfeea5c4-0b5d-402f-9ef0-d783e8e4f64e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:52:34.860063+01
d4662542-3eaf-49c8-b056-48a84b584473	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:52:36.123828+01
78127aa6-46da-4bde-8ee9-c377a2456da7	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:52:40.918166+01
c1109c89-f630-46b6-9774-7c5f8b414d6c	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:52:42.195785+01
6b7e0aa4-a857-46cf-9521-c8d5bfdf621e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:52:42.567818+01
ff635553-74bc-40cc-b5c5-f43030675d0d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:52:43.008913+01
bcaceac4-c578-4976-a662-1bc9e79d5583	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:53:10.12738+01
bd37680d-4486-4e9f-8c59-11c47ad2a917	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:53:10.21409+01
67ca1069-45a5-4920-b6b7-b4c265b3b691	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:53:14.594247+01
290dd21b-4b0b-415c-bd0f-095bd047b509	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:53:15.186906+01
b26b4da4-7186-4e82-88dd-967aa629b67f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:53:15.877325+01
a482a426-8eaa-4d87-95fa-cdeae99ed105	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:53:36.69738+01
9f857188-6cb2-414e-9a38-cd385ad81890	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:56:17.865153+01
67d76f37-7d1a-4a7d-af20-16173222af66	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:56:19.276231+01
35514155-c020-4477-9aad-bf239601f000	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:56:40.00881+01
7807d183-4e96-4c21-9c16-b0b40ace34a1	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:56:43.591439+01
563f0cb5-d8fc-494f-aeab-52338d0bc22a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:56:44.223472+01
eceddc2d-b5e0-4ddb-bf7c-5ab0ad19f04e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:56:44.997922+01
27f5d040-9bba-4ee2-a57d-aa566d152d9c	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:56:45.4225+01
4c584934-6f9f-4816-a33e-cc89c200b008	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:57:04.86315+01
f6b07859-bc71-4ffc-8b79-b1366336ec4f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:57:08.812954+01
ca5cf466-3dc5-4664-b47b-3f0ba4bf9460	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:58:35.159325+01
1a92e155-4bee-4797-83de-a2cc25e1867a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:58:35.25569+01
82416c6e-d818-4bad-9722-5dc8bb090ef8	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:58:38.732233+01
1ce4e876-a4b9-41af-b9b5-127710390099	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:58:40.156645+01
83177ad1-a4e6-412b-83d8-9d6e21a998fc	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:58:40.997963+01
24a2b934-580b-4970-b404-fc5206bf5719	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:58:46.033438+01
96456adc-61a5-4361-b1f9-0868461593b5	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:58:47.774712+01
3ea5d4cb-626f-42c3-89b8-b90dfe612a18	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:58:49.132489+01
655b3157-83bd-41fe-b4cd-64d054debc56	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:58:49.66428+01
12fe3793-06a2-46c0-8d45-7d975e2b4119	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:58:50.930101+01
f373190f-3921-4c81-bc3b-03f3583885ad	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:58:55.759326+01
b4a13e5b-dfb0-416d-8abf-6a216bf726fd	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:59:02.895869+01
b61b9bda-3020-4e32-864b-4e46ede01576	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:59:11.684072+01
fe082650-fd7e-4431-aa80-590de85ee03f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:59:15.688877+01
f48a2033-26a0-4498-8b09-9e491d19f72f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:59:17.718706+01
b2d708a5-e808-4e02-86bd-1ce54ded1b29	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:59:22.018424+01
b855606d-0c53-467e-8c5e-b276985a891d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:59:25.337571+01
7a099115-d044-4d8c-b7de-9f1688964320	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:59:28.09393+01
4842df30-852a-4579-bbce-e38b3829087f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:59:33.922667+01
4b040e3a-dc20-4e2a-8a33-fe59d6f84860	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:59:38.031192+01
e838ea17-11de-443f-b7d9-20dca5af2b0d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:59:38.858808+01
60d24c43-8e08-4e3b-bc7f-0ceb48926893	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:59:42.808416+01
bd6a4921-4edc-4bf5-8cfb-febfc28b5133	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 22:59:44.206291+01
55fa393d-34dc-4865-bc50-8dffcac34d9f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:00:03.704557+01
29882263-587f-4eaf-b8c2-3967c2f12823	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:00:06.651457+01
519b9c90-f362-4398-8be2-816435d4aafc	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:00:06.857198+01
f7f7afaa-4adc-4c41-8d9e-5abf91fdd082	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:00:08.124126+01
b33dcd42-4d40-4030-bb61-35365a64311a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:00:16.38708+01
9f05d78d-5772-4026-93c0-7262bb512de2	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:00:18.986046+01
5fbf6282-2475-4f37-b430-c0ac661887e4	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:00:20.893758+01
5c84a314-8628-4fa6-aa93-b714f33eb4cc	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:00:22.143219+01
552e1469-fa5e-4913-983f-a97b4412684f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:00:33.032179+01
c2cda81c-5fd5-4969-9c31-303658d8d408	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:00:33.714988+01
cd3216bf-50a2-47f5-a3a2-d43a6532d21e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:00:45.707552+01
09cf2f37-9292-47bf-b12d-f563d6531b28	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:00:48.600972+01
53f173d4-bee1-48b8-acf2-95015e2151a3	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:00:49.874531+01
5d143772-457e-4b87-a7c4-16c5fa624c91	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:00:51.207424+01
624146be-55e0-442c-9ea8-8ac3f56defc6	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:00:58.634975+01
395016dd-c58f-4d39-a510-b1502385e4f0	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:01:01.958496+01
4fe078d8-c099-4a03-952c-05f4be851887	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:01:02.899671+01
5bda341e-44ac-4f12-9c5b-6637e8d2a696	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:01:07.339223+01
9d4a2693-701b-47ff-9e3f-a5b2646f0ac4	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:01:08.491803+01
c81341d4-5b76-4ec7-98d8-5e2bd753eaf7	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:01:14.295006+01
345cc482-6fcf-40bc-95fa-c1408e66fa86	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:01:15.269111+01
6134b9f1-519c-4080-a33c-ffeb85cdea64	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:01:18.308981+01
a6ac949e-ab0d-4898-9dc8-5880e1783d8d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:01:38.778278+01
5183734c-48cf-4611-ac25-cfae66ad3ed2	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:05:32.453609+01
9d06607a-f560-48b2-b33d-2c6a892cb39e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:05:32.518457+01
c9306a7c-4bd0-4dc5-9849-b12bce127b47	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:05:41.877911+01
9fd6d8d8-c399-406b-aa68-5aec6721d3c8	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:05:41.935983+01
e08f5c53-d900-4484-9545-f37678a7a336	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:19:08.774271+01
08995e26-a974-4c8a-87c1-903a3bf773fc	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:19:08.807018+01
a01f075d-5055-4cb7-becd-ac9f14363635	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:19:48.131782+01
2e6f1c9d-60a4-43f2-be79-90ef6edd73a2	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:19:53.700805+01
c867ba36-46af-4c04-b921-9d4ca4dd4554	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:21:19.867579+01
9cd54a83-6411-4015-948e-1ef4f1785b24	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:21:23.88378+01
400a70b2-95f2-4cb2-b051-99f492d22ad8	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:22:14.027007+01
ba8ae641-13ab-497b-9a3f-9edd26f9acde	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:23:12.432597+01
d4cca727-825a-442f-a432-7aad26106ca3	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:23:16.605453+01
0ce41a88-694a-40e5-8036-dff4585b80ce	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:23:18.451428+01
38d790b2-3e78-4d63-a94f-b6a29b0cf50e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:23:21.117596+01
0a42032c-7557-4109-91c7-336ba8a06a77	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:23:22.321961+01
812ba4a6-6808-4cb7-a351-545903363584	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:23:42.598443+01
94c76759-ae4e-4a69-ab23-5d84a7680f20	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:24:18.082944+01
7f86f4a1-4933-49d4-8b25-0948165d2fc2	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:24:18.297827+01
648bc5f8-94d8-4923-a8c3-41daff51d2d8	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:24:21.15472+01
e8b2238e-217b-49ff-84df-528fa72bacec	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:24:25.677869+01
cb8628ac-2ea9-4eea-ab92-105a0877442f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:24:32.04363+01
61f0e466-1f79-4e07-8dd8-852bc3edf86e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:24:40.003736+01
7a4c4d7d-c94c-4801-bbc0-1347feaecb0a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:24:40.069367+01
9d97836d-ae33-47f4-a78e-9ac7a1a48977	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:24:40.192952+01
dc286843-5de3-4fc9-9195-b5d640387c78	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:24:40.600738+01
ad6b4ecc-fe91-4bdf-ac07-f9a27edb3f09	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:24:40.875222+01
baee0087-0efe-4fe7-bdaf-1f0bd2f02edc	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:24:41.024788+01
ece1afc3-f32f-42cf-953f-7af4fbdd139b	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:24:41.399305+01
2277bad8-c9e5-42c5-ae68-d9df4cf68fd4	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:24:41.540397+01
93b1e1ba-db6d-4ee9-9511-de46bfec7c68	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:24:41.58068+01
7ced20c0-f231-4d3f-b6f2-3622f2b1cbcc	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:24:41.822103+01
155354ea-53b0-42d1-a61f-55d470192fcc	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:24:41.83479+01
4f8db11a-89a4-4cdd-866f-7f7326621a34	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:24:42.012585+01
ee496fab-3460-4483-8c7d-6b1de1b25862	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:24:42.512126+01
503018d6-2818-48ce-9d0f-a7b639aa388a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:24:42.610668+01
4df821a9-a5fe-4674-bf18-0bdda0f5ea73	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:24:47.077503+01
d5334714-b76e-4a9f-bc46-795734470a36	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:24:47.207035+01
15193c4b-1b8a-4766-a630-4247fd357a27	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:24:47.503099+01
36c67972-550d-4626-9b14-d62676268816	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:24:47.593803+01
c3e192ec-6606-49e7-949a-371053f56f06	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:24:48.564603+01
a285b2d0-c016-4636-a03c-d820ff72337c	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:24:49.155719+01
89ee3ff0-0fd8-418a-bc75-10b41fdacc5c	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:24:49.570988+01
12c3b139-2fb0-4b38-ba0a-549ca36fa694	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:24:53.839178+01
3c4824c3-0c3a-49ae-8b94-a412dd81f0a3	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:24:56.404979+01
31b9520f-760e-49dd-b218-db1be820a740	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:25:00.212614+01
361ff773-177a-4dd3-b154-bb9868e8bb03	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:25:03.106966+01
bfd5204e-1922-4b1d-947d-86020485b800	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:25:09.108665+01
7f703e55-1df4-47b9-a679-d216fb5dd2c8	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:25:09.357892+01
827a9f1b-e7a2-425d-8183-4f8d7dcb0361	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:25:13.121985+01
ad237aaa-006c-4310-a5f6-e1d04d952476	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:25:15.488375+01
ba6e4b13-d93b-4070-a6db-e9844e3a85dd	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:25:18.087014+01
3f0af6c5-3217-41a7-a1c7-e6aa040de30f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:25:18.586497+01
d9e4e3e1-9029-4317-a6a9-4eda85b937dc	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:25:19.218381+01
9372fc6f-745d-4e83-b410-767b2553f7f0	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:25:20.134514+01
806db47e-a366-490e-9fa2-aa7a5f8048f9	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:25:22.05895+01
566ef8c2-e945-4a7c-a877-0d5686173edc	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:25:23.228212+01
0f3e9b59-07fe-4450-81aa-8e589c5345ad	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:25:27.152119+01
0f1b950e-e51b-4087-9d03-f65542e5d598	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:25:28.209928+01
37d643da-7f8b-4efc-960b-edf6dba8d3fb	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:25:48.640571+01
a4477da6-966c-4fe0-bcec-337fe1075403	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:25:53.562057+01
478845ce-b8a1-4581-a565-8f6d78c2f502	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:25:54.791453+01
6518cb14-e92d-4c31-8e59-0c61bf7eef13	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:25:55.766077+01
168c9c2c-55ad-4a73-861f-4295a1d3de89	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:25:57.573696+01
2ea74410-3992-4698-9be2-7aed4aa33787	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:26:05.654479+01
ae5abe4f-3536-4ef5-b00d-c3613126e737	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:26:09.073448+01
1b9839c2-eaf9-4751-8b9d-1d86535ecb57	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:26:10.298017+01
cbaedb78-49c9-4b62-af73-d785eb0900ae	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:26:11.33083+01
7e157987-e6df-49c2-8128-1ab81e2b3254	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:26:20.273477+01
73ac145b-e52c-4079-b411-27f97f329945	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:26:22.793048+01
277955f4-ab34-44ef-9f68-b1c6d979cb3c	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:26:25.111907+01
dc9c7c0c-0ec1-4b18-aefd-f21609ab7782	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:26:25.828611+01
8257ae5e-3bea-4427-915e-5aeff54f655f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:26:28.831605+01
6e45d448-4f18-4dc7-862f-d52fa0fa05de	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:26:29.381077+01
6cef648f-03e4-40bc-a60a-a2a1e5cf6035	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:26:59.702459+01
9b024e2e-fde7-43ee-91e2-9058c5a8db19	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:27:00.017231+01
9b754826-7e5d-417a-81a1-8a69ea5a4228	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:27:00.933585+01
903ae1f5-7e2f-4d26-a940-45c6142a7379	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:27:01.433121+01
abbee436-908d-4550-828d-c8dc5bdd7d36	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:27:01.814958+01
fb23115f-e4fa-4d3b-b65b-1dcdafb5becc	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:27:02.281171+01
041a1718-bd67-474d-b6db-4fcd578d399e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:27:02.691912+01
004ec7a9-0da7-47a6-a5e7-3711b1691b88	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:27:03.099738+01
dd7aa5a5-15fc-4328-a276-29e6a8332ef3	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:27:06.299159+01
bd67e96f-05cb-4633-b13f-c808bc849dc7	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:27:06.331841+01
7cf618dc-e9d3-40c7-82e0-018b31ddaec9	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:27:08.565099+01
1e87d594-326c-4725-ac4f-08ad20eedaea	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:27:08.668602+01
683a3182-38dd-4257-9386-4e304d6f4937	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:27:29.520617+01
e3ce280f-e799-4bb2-bc7a-e6bb376768af	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:27:42.744369+01
83666f65-9abf-4245-8df8-a5cdf14c79b8	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:27:44.540429+01
8e464740-b338-4478-93e7-8227ab44c137	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:27:52.08397+01
f9068815-73b1-4bfa-b70e-2ac81763bea6	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:27:58.419431+01
c54a603e-4239-4454-a299-96ca3e1d3040	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:27:58.442742+01
955b4880-3650-407a-8631-eeb3f875e2b4	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:28:08.248963+01
b03bab91-6f18-43cd-8f2b-e79922fe419a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:28:08.616532+01
0adda9f0-f972-4824-9644-1076b15f8d8e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:28:22.291896+01
705de87e-104a-415d-903c-0ff9108415f7	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:28:25.905162+01
031fe8a2-52bc-4665-b2a2-63d373f59554	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:28:26.254324+01
2a72b72e-8b1a-45a1-9aaa-8140629c21ef	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:28:26.587104+01
c495f62f-00be-427e-a2ce-903baba52182	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:28:28.402209+01
25fdc786-2123-4f6f-af92-5ed2bc24f8ca	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:28:28.943364+01
4949014f-5f2a-4de8-a12d-74979364ae3c	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:28:33.400799+01
aeb63d9b-8832-4983-aa1d-41f1ef0e3f57	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:28:34.030566+01
0a83d5b5-38cc-4a24-8770-1b4f2d639275	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:28:34.420593+01
4120e025-2eef-4349-9be9-e620b48aba70	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:28:34.753659+01
62718b50-1c0b-4576-9208-eb897b4f96c4	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:28:35.561131+01
0ae715cb-141b-4e17-9cea-767e890966d6	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:28:39.057623+01
08a46330-a69d-4e56-9e66-07fb015aa39e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:28:57.004707+01
3350efdc-f9fe-4c23-b863-211022ffc299	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:29:01.058543+01
214d4692-80e9-42d3-938a-c3f4318a1bd1	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:29:03.033921+01
ad95db19-caf0-4e25-a63a-89aac6a026bd	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:29:08.513066+01
5909f6fd-cc67-42f5-a7b3-2d600c12fb09	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:29:08.592239+01
879863d4-2db7-4a71-a071-48f2881643a5	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:29:10.175884+01
ce7d844a-dedb-4705-879f-a4de0ca82625	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:29:11.083732+01
befc17d1-6ac9-4515-bf8a-7596d743ace5	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:29:12.180922+01
1a5e9296-e57f-4a40-845d-ab48013af37e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:29:12.738778+01
b1e7f035-eab6-4197-af72-be455254d52f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:29:13.078972+01
11f77ae0-1bf6-4858-a300-7195cc60a7f4	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:29:13.428482+01
b27575ea-214f-4243-9e0d-7edce1a46b0f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:29:13.902914+01
e4af2c5e-14c9-4219-9dc2-73d5b12510c5	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 3}	2026-01-08 23:29:14.260909+01
67dc1076-3f15-4318-9d68-3bb835a3612c	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-08 23:30:01.90635+01
f6a31b5e-6e8c-4e21-9076-4bd8ee000f11	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-08 23:30:26.1709+01
2a68a089-6e2c-464e-b428-0e2daa1230fd	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-08 23:30:41.71066+01
e123b1be-0ac0-4a7d-91cd-0bee70f5ef7f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-08 23:32:52.207695+01
ac0f8caa-c7cc-48c5-aedb-28b442575ae1	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-08 23:33:02.978535+01
2421566a-3cef-402f-b5c2-a2cee0fa9b38	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-08 23:33:14.050605+01
74c69c59-3130-4af7-9508-a657b468f941	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-08 23:33:30.811896+01
b2469aac-b5c8-462f-b647-cbaca9a8df38	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-08 23:34:22.19562+01
4b3ad2b0-7204-4431-b21f-72bd81515757	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-08 23:34:30.03339+01
0b25c9a6-e558-42e0-b220-47a6d5b372a1	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-08 23:34:30.919731+01
1d748ed3-8132-4f25-bbcb-2482e5398e83	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-08 23:34:49.796156+01
6ac81fdc-8247-449c-8a14-989a549c5b48	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-08 23:35:18.732447+01
254933b2-0ca7-4f54-81a5-c5ff7aa52ed3	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-08 23:35:32.70509+01
568a9b50-07be-42a3-9d0e-d302156da565	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-08 23:35:40.932178+01
2066ac66-04bc-4bbc-b336-85081ade3d18	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-08 23:35:45.522839+01
d0007239-21a6-4404-9617-2e8899a24b2d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-08 23:35:54.875708+01
33627f6e-e2ca-49c7-80f1-7ce0acd61edb	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-08 23:38:47.191464+01
79cbb9a4-1207-40c5-89e8-be0379bc2d94	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-08 23:39:54.483316+01
76256f46-77eb-482c-944f-0934fc484a7d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-08 23:39:57.69113+01
856fc8b9-9a6e-4378-9136-7cfbd7bbe22a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-08 23:40:00.251855+01
f323f0dd-8ef2-432c-a381-c276248217d6	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-08 23:45:36.678928+01
24eced48-5646-4881-9b8b-fe4cc49f4e6a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-08 23:45:43.081532+01
90089779-deeb-4824-8e4e-ea6d81adb0a7	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-08 23:45:43.094421+01
a78fba81-ceda-4a83-b286-adb593bcfe2c	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-08 23:45:51.053568+01
d66d935a-25d4-4bf3-823e-1351dd82e61d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-08 23:48:02.590469+01
f935966e-69c5-487d-a556-45da79aeaed9	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-08 23:48:03.537012+01
b6380838-bfe2-4c54-a821-8f117471da35	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-08 23:50:12.195224+01
10428a42-9eeb-43ee-b732-0c6b47acf4c3	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-08 23:50:12.302295+01
6f3c50a0-7e82-47dc-bada-0b557de42b08	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-08 23:57:54.965672+01
3d4a5230-114b-4a64-a7e1-8be1372b0b81	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-08 23:57:55.321198+01
c2dea258-c812-4a86-aba7-e1456054bebb	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-08 23:57:56.079133+01
93bdf67c-1c5b-4dfa-b468-03b777a6e997	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-08 23:58:13.579998+01
3e5b73ba-fcc5-4f72-a604-727a3574068d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-08 23:58:17.737627+01
2a7e9bd7-a109-401f-ad85-517921949341	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-08 23:58:18.38661+01
ee01f038-d133-4f7c-81ad-9bf5281c47e5	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-08 23:58:22.561967+01
73c2bd05-5600-4c9b-8096-56cfc8d84dd3	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-08 23:58:44.05183+01
f63ea1f6-ffe6-43f0-9c79-04b35460e4ad	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-08 23:58:44.596977+01
40b6dac6-6174-4835-a339-20ccec3fc5fe	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-08 23:58:45.637985+01
60863cdb-0736-4955-8531-5ee94093529a	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-08 23:58:47.095813+01
545d2dd1-6bb6-49a3-a9db-ce3b1a27f09e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-08 23:58:49.128616+01
7b2a953b-a6ef-480d-b9e9-84ed6893bd5f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-08 23:58:52.423071+01
5079f430-657a-4d43-9367-28f774390e09	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-08 23:59:04.416323+01
ecea92e7-66b9-4e19-80ba-bfb6dc968bd4	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-08 23:59:05.260744+01
7551e880-c873-481e-b254-1a62a4c60242	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-08 23:59:06.226857+01
39731166-2cd4-4fcf-8c2d-473ea78f23f0	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-08 23:59:06.942184+01
58a9f296-6f9d-4a1a-8886-feb265cf6427	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-08 23:59:07.850039+01
9af8fce1-6c98-4eeb-b1b0-397128d611f5	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-08 23:59:08.740234+01
37836afe-1c19-4ba1-b8ca-a8b36829fa3d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-08 23:59:11.909784+01
bae465d8-16b3-41fb-bd83-448ce73816c4	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-08 23:59:12.072012+01
d8398938-3f0e-48ee-a756-8f0482f04f1f	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-08 23:59:36.734101+01
ab82706e-5a22-407d-83d3-b1ae78b59adb	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-09 00:00:26.081433+01
06eabf11-8471-44ba-b194-f40e93c416d8	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-09 00:00:34.842985+01
bc7b524c-00fd-4e04-b6dd-b38a444eb612	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-09 00:00:35.858088+01
b66c0d86-d59c-41c5-a2b1-4111abd3dd1e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-09 00:01:04.059026+01
21d585d7-270f-477b-84ea-54655d4444db	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-09 00:01:31.172345+01
071be6db-81fd-4474-8316-54e28baf6d0e	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-09 00:01:31.964773+01
93126731-d251-4278-97e9-62c2e15364e0	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-09 00:01:32.780896+01
30853d6c-04e2-4207-be75-84e1f0950cd8	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-09 00:01:34.280466+01
3d8a9dc0-f561-4400-870c-af82e07953e5	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-09 00:01:36.837287+01
5eb217e9-a6fc-48b1-8199-cf5f4384270d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-09 00:01:37.377929+01
c990f051-b3f5-4721-9878-2bfd0b044623	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-09 00:01:37.960672+01
1f827b10-6848-4f7a-9d25-127c585edc67	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-09 00:01:38.468502+01
b8905c20-1bd1-48f8-9ac3-a973f301e584	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-09 00:01:41.034278+01
4cdce3dc-9459-4f39-8c3a-c5b847ffd608	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-09 00:01:41.508413+01
460bc749-08ca-4fb3-85ab-e4d56a3813fa	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-09 09:00:00.892697+01
e41fb446-a878-4c5a-a9ad-582dcb05c5bf	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-09 09:00:00.846609+01
688c0c95-42df-4907-b3e0-3ab57a7deadf	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-09 09:07:00.841571+01
b79477f6-60aa-4624-9d7b-b354b6fc76d5	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-09 09:07:00.899366+01
c6658c41-f71b-4c52-b105-ed37460fe527	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 0}	2026-01-09 09:07:06.155978+01
33b00a79-2ff5-4ef6-8ad4-6efab9b8c470	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-09 09:07:06.259413+01
5d1235fe-6526-4e41-9d99-754372c7d668	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 0}	2026-01-09 09:16:17.25209+01
74cfa8e0-76bc-4ea7-97d3-8c1452394c39	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-09 09:16:17.272607+01
072a417f-9a54-40ea-9754-059114808294	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-09 09:18:35.019387+01
7d50f695-3ac5-4a4e-8122-e1c2efbbd943	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-09 09:18:35.060533+01
c72c4846-4521-47dd-b2da-5a0e64b465f8	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-09 09:18:47.480574+01
d58ee477-707b-4d99-b323-2ea6e87ab7d0	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-09 09:18:47.513325+01
0f042222-4bad-4662-9bdc-099f389a3819	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-09 09:19:29.150177+01
6b7ce491-1ca7-45f0-afdc-9a78315838ba	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-09 09:19:29.182931+01
6b61752d-e9a7-4f38-847f-7a6b553ae490	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-09 09:21:10.020549+01
ddae2da7-b5ea-48ba-9c46-b2f0926c20e4	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 0}	2026-01-09 09:21:13.399992+01
f229a2d7-0a25-40be-86a8-dd90e7b70fc5	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-09 09:21:13.432827+01
05c5c643-1d97-4d6b-b81b-e45fde23164d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-09 09:55:40.026033+01
eeefc9cd-de02-41e3-b3f4-cbaa675f7b09	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-09 09:55:40.237202+01
a801e50a-6721-4b6b-9be9-baac35f6e1a7	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-09 09:56:48.951927+01
0a6d8fe5-f555-41ec-a48f-1740c336fdbd	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-09 09:56:49.455882+01
0ba9fe80-852c-431e-86a8-6b2d802b1c3b	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-09 09:56:49.813831+01
c8e3f3de-005e-4252-a974-b24de508ea84	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-09 09:56:50.18001+01
6a535043-a2ff-4ca6-ae96-19478c3fc692	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-09 10:21:24.861201+01
cf8edc76-ab09-4c0a-abc3-75cb340bdde2	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-09 10:21:24.917517+01
732e0514-8f75-4faa-b721-1e4bf7fa86b5	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-09 10:21:26.511382+01
7cbaaeae-2d82-48de-8dcf-72c123c9af76	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-09 10:21:27.027025+01
a659ec66-9699-4c25-afa6-579a5ea772de	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-09 10:21:27.578035+01
9e87a8dd-b632-4175-812b-b639979f897c	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-09 10:21:28.125563+01
eb41681f-d5a1-4ea8-9ccd-0fab4fd21f57	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-09 10:29:01.269276+01
9fe033cf-2a51-4380-aebc-5f29365051dd	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-09 10:29:01.325853+01
f9d26467-7834-4a82-a88d-a133f0e14e0c	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-09 10:48:27.050703+01
c1a5788a-d77e-4bba-adaa-3b9c599d697d	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-09 10:48:27.090636+01
efc37555-c45e-47d8-b2d0-3b3f77734c89	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-09 10:48:28.36348+01
104f114e-9bde-4537-a097-1ff502791a54	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-09 10:48:28.827571+01
935c98f6-c25c-45f6-8136-b5626f5d2be2	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-09 10:48:29.235626+01
8fef3ab9-ecaf-4ded-89da-597681fa8398	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-09 10:48:29.601881+01
0b904011-d232-45ad-bc02-5304a988859b	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-09 10:56:39.871884+01
17fcb643-ae1b-4c03-85d7-f188815a8050	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-09 10:56:39.912809+01
b1779872-0df9-40f0-a7a3-6f524059ff31	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 0}	2026-01-09 10:56:59.607559+01
a8a901b8-d224-4401-a0dc-bc78d6afc0de	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-09 10:56:59.665386+01
e66aaa5a-8d81-497b-9c98-6e1828f99263	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-09 10:57:16.121214+01
008c91e7-f132-48de-8a30-e4b272c9b771	cedba177-5aa6-4d81-82d6-f09aecb47dfe	state.save	app_state	1	{"collections": 4}	2026-01-09 10:57:16.162078+01
\.


--
-- Data for Name: permissions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.permissions (id, role_id, collection_id, item_id, field_id, can_read, can_write, can_delete, can_manage_fields, can_manage_views, can_manage_permissions) FROM stdin;
8b67bcf3-1c48-47a9-add3-50b57f57c000	e8b2d77a-7e32-434f-b894-4291837038b7	sites	\N	dev	t	f	f	f	f	f
ef81a57b-0562-4f4a-9c01-d8b25a0793f8	e8b2d77a-7e32-434f-b894-4291837038b7	sites	\N	rédac	f	f	f	f	f	f
7f32f3d9-744c-4919-9b03-d878383de406	e8b2d77a-7e32-434f-b894-4291837038b7	employees	\N	\N	t	f	f	f	f	f
e9f2993a-2f59-4a44-9cfd-64d618895afe	e8b2d77a-7e32-434f-b894-4291837038b7	employees	\N	name	t	f	f	f	f	f
2fd90e25-654b-4ad7-8a6f-c3ee72e53316	e8b2d77a-7e32-434f-b894-4291837038b7	employees	\N	role	t	f	f	f	f	f
6028f5d7-9a67-40d1-8e3a-e5025a1cbbcb	e8b2d77a-7e32-434f-b894-4291837038b7	employees	\N	sites_lié	t	f	f	f	f	f
7c026317-b205-4a20-a505-6a2b55638fe0	e8b2d77a-7e32-434f-b894-4291837038b7	companies	\N	\N	t	f	f	f	f	f
67d5fe5d-8770-4a1c-982b-013c5936c122	e8b2d77a-7e32-434f-b894-4291837038b7	companies	\N	name	t	f	f	f	f	f
fdd22b6f-60f6-4278-b55a-e962bcc9df54	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	employees	\N	\N	t	t	t	t	t	f
773b833a-5a0f-45f9-85d3-44f6dfaddf80	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	employees	\N	name	t	t	t	t	t	f
292fd027-2105-4564-9c99-f8e7c421aede	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	employees	\N	role	t	t	t	t	t	f
d51cd0a2-2e17-499d-b5aa-53859387e742	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	employees	\N	sites_lié	t	t	t	t	t	f
7de05295-d0bf-4a46-afa0-cce4dec1d227	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	companies	\N	\N	t	t	t	t	t	f
1ca84a36-a6f0-4830-9b81-b84f978199d1	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	companies	\N	name	t	t	t	t	t	f
e9b5d6d3-40fd-4aeb-a994-8dfdc6801676	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	sites	\N	\N	t	t	t	t	t	f
3630593f-a44f-4c45-a378-89fe9a13e53b	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	sites	\N	name	t	t	t	t	t	f
e8a48059-4151-4b7f-976e-650b65006f59	133acd06-d1e0-4be0-813f-52e29263b1ee	\N	\N	\N	t	t	t	t	t	t
eaeb69eb-0a55-45d1-958e-a14510969dd3	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	\N	\N	\N	t	t	t	t	t	f
204381dc-cb76-4e0c-a551-4379f1a930f0	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	sites	\N	dev	t	t	t	t	t	f
96810209-31d4-45b0-ae14-58127f0895e2	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	sites	\N	temps_rédac	t	t	t	t	t	f
f2d3c892-2e86-456d-8b57-5bd1e8078dd2	e8b2d77a-7e32-434f-b894-4291837038b7	\N	\N	\N	t	f	f	f	f	f
f3ef0b73-6751-4f4b-af83-3841d83749ac	133acd06-d1e0-4be0-813f-52e29263b1ee	employees	\N	\N	t	t	t	t	t	t
49e66aea-7c56-4f1c-af70-b7299c7f7adf	133acd06-d1e0-4be0-813f-52e29263b1ee	employees	\N	name	t	t	t	t	t	t
f68f225b-43fb-4978-8594-1f859f225ce2	133acd06-d1e0-4be0-813f-52e29263b1ee	employees	\N	role	t	t	t	t	t	t
0c110df1-ff39-42fd-976a-5d15fec9a272	133acd06-d1e0-4be0-813f-52e29263b1ee	employees	\N	sites_lié	t	t	t	t	t	t
17390469-33b4-4386-8ef7-b342d14afce8	133acd06-d1e0-4be0-813f-52e29263b1ee	companies	\N	\N	t	t	t	t	t	t
a9cd9c3c-b925-4a8f-9285-f140864f6fad	133acd06-d1e0-4be0-813f-52e29263b1ee	companies	\N	name	t	t	t	t	t	t
9fc4ff8a-912c-45f7-9cb5-7f39291746f7	133acd06-d1e0-4be0-813f-52e29263b1ee	sites	\N	\N	t	t	t	t	t	t
b232e429-927d-454b-8540-2f6a7713dde5	133acd06-d1e0-4be0-813f-52e29263b1ee	sites	\N	name	t	t	t	t	t	t
ae3673ce-76ba-418c-ba03-8780dd62ec3f	133acd06-d1e0-4be0-813f-52e29263b1ee	sites	\N	url	t	t	t	t	t	t
0863da8f-9f32-41a5-930c-17011b0f20d4	133acd06-d1e0-4be0-813f-52e29263b1ee	sites	\N	status	t	t	t	t	t	t
882fa886-d04e-4ba6-b544-b601ce5d9473	133acd06-d1e0-4be0-813f-52e29263b1ee	sites	\N	dev	t	t	t	t	t	t
1a891eb2-8519-455e-99b0-107b21aae0bf	133acd06-d1e0-4be0-813f-52e29263b1ee	sites	\N	temps_rédac	t	t	t	t	t	t
3c409fb1-011c-4639-a977-00490459821f	133acd06-d1e0-4be0-813f-52e29263b1ee	sites	\N	temps_dev	t	t	t	t	t	t
31bdc361-465a-4d74-8ad8-c171b1b2c74b	133acd06-d1e0-4be0-813f-52e29263b1ee	sites	\N	rédac	t	t	t	t	t	t
bcff015b-83eb-4ffd-9aa1-4016fb67388a	e8b2d77a-7e32-434f-b894-4291837038b7	sites	\N	temps_dev	f	f	f	f	f	f
15bb34a7-7972-4cdc-99a8-f9ec49ce80f4	e8b2d77a-7e32-434f-b894-4291837038b7	sites	\N	temps_rédac	f	f	f	f	f	f
dabc8d09-04b2-432c-8755-ac1cc459bdb7	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	sites	\N	status	t	f	t	t	t	f
c838cc4d-0afb-4325-b55a-e1ea43141064	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	sites	\N	url	t	t	t	t	t	f
a2873a08-3478-406b-b3b9-1924708d403e	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	companies	\N	sites_lié	t	t	t	f	f	f
ecf153b5-00bc-4930-a342-a6859df65230	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	sites	\N	temps_dev	t	f	f	t	t	f
e811f739-fc4f-4e9b-a637-4f86aaa71e0a	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	sites	\N	rédac	t	f	f	t	t	f
fa883c5d-e715-458e-b6b9-9fa5fd4cf562	e8b2d77a-7e32-434f-b894-4291837038b7	sites	\N	status	f	f	f	f	f	f
1511a258-b343-44af-a7ec-7f39688231d3	e8b2d77a-7e32-434f-b894-4291837038b7	sites	\N	\N	t	f	f	f	f	f
ecfe8fe0-e113-4f0f-83c7-18194a534ec7	e8b2d77a-7e32-434f-b894-4291837038b7	sites	\N	name	t	t	f	f	f	f
f088c619-841f-452b-ac8e-c7b3d0a85412	b8c5cb21-e698-45e7-bbfb-6aeca891af0e	sites	\N	entreprise	t	t	f	f	f	f
ac26dbc4-81a4-483f-8ed9-09cb65dd820c	e8b2d77a-7e32-434f-b894-4291837038b7	sites	\N	url	t	t	f	f	f	f
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.roles (id, name, description, is_system) FROM stdin;
133acd06-d1e0-4be0-813f-52e29263b1ee	admin	Full access	t
b8c5cb21-e698-45e7-bbfb-6aeca891af0e	editor	Read/Write/Delete, manage fields/views	t
e8b2d77a-7e32-434f-b894-4291837038b7	viewer	Read-only	t
\.


--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_roles (user_id, role_id) FROM stdin;
694e5070-1877-42b9-9268-650ff19a63c9	133acd06-d1e0-4be0-813f-52e29263b1ee
cedba177-5aa6-4d81-82d6-f09aecb47dfe	133acd06-d1e0-4be0-813f-52e29263b1ee
bd371f64-4c05-4e4c-b65d-ab2449962ced	e8b2d77a-7e32-434f-b894-4291837038b7
c6475cce-899b-4c0e-9ed4-cd90e5a17671	e8b2d77a-7e32-434f-b894-4291837038b7
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, email, name, provider, provider_id, password_hash, created_at) FROM stdin;
694e5070-1877-42b9-9268-650ff19a63c9	test@example.com	Test User	local	\N	$2a$10$aBAO/37VSf/ijiwxxTAkeu66d0poiRM4qpyCUoPgC3Ku41gqWebgO	2026-01-08 10:20:32.558819+01
cedba177-5aa6-4d81-82d6-f09aecb47dfe	sutter.yllan@laposte.net	Yllan	local	\N	$2a$10$eiGaw3Kvbs.AjvXKUuBeSud0glRsGMGR361bvZ3w3hUIlGCKYXoXW	2026-01-08 10:21:36.389256+01
e1b2b053-6c3e-4e44-a72c-e631fc438b62	test2@test.fr	Test 2	local	\N	$2a$10$T261rLeZtmQFrfH84PfpjOnHNuooKXgbnungU1BzNFQzI7jFthSnS	2026-01-08 10:26:14.474794+01
63d16544-5af7-4005-b4ed-de807754a138	test3@test.fr	Test 3	local	\N	$2a$10$XSEPRV2atDgI4M99RyhggeTcD2detkH6yaivvbTps8uerhioYyxBy	2026-01-08 10:29:08.749736+01
bd371f64-4c05-4e4c-b65d-ab2449962ced	test4@test.fr	test 4	local	\N	$2a$10$lSSCVVOnGqyqJc9k2AC8lOg8OfdybxF.K/kEtRipufc9iYe786yRO	2026-01-08 10:30:01.348229+01
c6475cce-899b-4c0e-9ed4-cd90e5a17671	test5@test.fr	ttest 5	local	\N	$2a$10$bLPwOuvNMfym4lBo5bz8BuEFbuxnBXB.wsGCtTIJNgJbT9/Iyzhkq	2026-01-08 10:30:35.813166+01
\.


--
-- Name: app_state app_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_state
    ADD CONSTRAINT app_state_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: roles roles_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_key UNIQUE (name);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: permissions_unique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX permissions_unique_idx ON public.permissions USING btree (role_id, COALESCE(collection_id, ''::text), COALESCE(item_id, ''::text), COALESCE(field_id, ''::text));


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: permissions permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

