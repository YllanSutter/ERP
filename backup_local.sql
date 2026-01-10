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

