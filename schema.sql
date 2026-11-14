--
-- PostgreSQL database dump
--

\restrict 14FFxt7onZQALDUPJhIBEdzGDEaRCnQQTeSEcy0EjCKUSn4kLC5CgSkEBD5K6T5

-- Dumped from database version 16.15 (Debian 16.15-1.pgdg13+2)
-- Dumped by pg_dump version 16.15 (Debian 16.15-1.pgdg13+2)

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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: document_fields; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.document_fields (
    id bigint NOT NULL,
    documentid text NOT NULL,
    field_key text NOT NULL,
    label text NOT NULL,
    field_type text NOT NULL,
    required boolean DEFAULT false NOT NULL,
    pattern text,
    not_future boolean DEFAULT false,
    active boolean DEFAULT true
);


ALTER TABLE public.document_fields OWNER TO postgres;

--
-- Name: document_fields_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.document_fields_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.document_fields_id_seq OWNER TO postgres;

--
-- Name: document_fields_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.document_fields_id_seq OWNED BY public.document_fields.id;


--
-- Name: documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.documents (
    documentid text NOT NULL,
    name text NOT NULL,
    required boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0,
    active boolean DEFAULT true NOT NULL
);


ALTER TABLE public.documents OWNER TO postgres;

--
-- Name: submission_values; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.submission_values (
    submissiontypeid bigint NOT NULL,
    submissionid bigint NOT NULL,
    documentid text NOT NULL,
    field_key text NOT NULL,
    field_value text NOT NULL
);


ALTER TABLE public.submission_values OWNER TO postgres;

--
-- Name: submission_values_submissiontypeid_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.submission_values_submissiontypeid_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.submission_values_submissiontypeid_seq OWNER TO postgres;

--
-- Name: submission_values_submissiontypeid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.submission_values_submissiontypeid_seq OWNED BY public.submission_values.submissiontypeid;


--
-- Name: submissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.submissions (
    submissionid bigint NOT NULL,
    phone character varying(20) NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.submissions OWNER TO postgres;

--
-- Name: submissions_submissionid_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.submissions_submissionid_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.submissions_submissionid_seq OWNER TO postgres;

--
-- Name: submissions_submissionid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.submissions_submissionid_seq OWNED BY public.submissions.submissionid;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    userid character varying(30),
    phone character varying(20)
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: document_fields id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_fields ALTER COLUMN id SET DEFAULT nextval('public.document_fields_id_seq'::regclass);


--
-- Name: submission_values submissiontypeid; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.submission_values ALTER COLUMN submissiontypeid SET DEFAULT nextval('public.submission_values_submissiontypeid_seq'::regclass);


--
-- Name: submissions submissionid; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.submissions ALTER COLUMN submissionid SET DEFAULT nextval('public.submissions_submissionid_seq'::regclass);


--
-- Name: document_fields document_fields_document_type_id_field_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_fields
    ADD CONSTRAINT document_fields_document_type_id_field_key_key UNIQUE (documentid, field_key);


--
-- Name: document_fields document_fields_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_fields
    ADD CONSTRAINT document_fields_pkey PRIMARY KEY (id);


--
-- Name: documents document_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT document_types_pkey PRIMARY KEY (documentid);


--
-- Name: submission_values submission_values_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.submission_values
    ADD CONSTRAINT submission_values_pkey PRIMARY KEY (submissiontypeid);


--
-- Name: submission_values submission_values_submissionid_document_type_id_field_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.submission_values
    ADD CONSTRAINT submission_values_submissionid_document_type_id_field_key_key UNIQUE (submissionid, documentid, field_key);


--
-- Name: submissions submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_pkey PRIMARY KEY (submissionid);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_userid_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_userid_key UNIQUE (userid);


--
-- Name: idx_submission_values_submission; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_submission_values_submission ON public.submission_values USING btree (submissionid);


--
-- Name: idx_submissions_phone; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_submissions_phone ON public.submissions USING btree (phone);


--
-- Name: document_fields document_fields_document_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_fields
    ADD CONSTRAINT document_fields_document_type_id_fkey FOREIGN KEY (documentid) REFERENCES public.documents(documentid) ON DELETE CASCADE;


--
-- Name: submission_values submission_values_document_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.submission_values
    ADD CONSTRAINT submission_values_document_type_id_fkey FOREIGN KEY (documentid) REFERENCES public.documents(documentid);


--
-- Name: submission_values submission_values_submissionid_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.submission_values
    ADD CONSTRAINT submission_values_submissionid_fkey FOREIGN KEY (submissionid) REFERENCES public.submissions(submissionid) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict 14FFxt7onZQALDUPJhIBEdzGDEaRCnQQTeSEcy0EjCKUSn4kLC5CgSkEBD5K6T5

