--
-- PostgreSQL database dump
--

-- Dumped from database version 16.9 (Ubuntu 16.9-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 17.4

-- Started on 2025-08-30 17:58:45

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 5 (class 2615 OID 2200)
-- Name: public; Type: SCHEMA; Schema: -; Owner: lmslocal_prod_user
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO lmslocal_prod_user;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 246 (class 1259 OID 20998)
-- Name: allowed_teams; Type: TABLE; Schema: public; Owner: lmslocal_prod_user
--

CREATE TABLE public.allowed_teams (
    id integer NOT NULL,
    competition_id integer NOT NULL,
    user_id integer NOT NULL,
    team_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.allowed_teams OWNER TO lmslocal_prod_user;

--
-- TOC entry 245 (class 1259 OID 20997)
-- Name: allowed_teams_id_seq; Type: SEQUENCE; Schema: public; Owner: lmslocal_prod_user
--

CREATE SEQUENCE public.allowed_teams_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.allowed_teams_id_seq OWNER TO lmslocal_prod_user;

--
-- TOC entry 3615 (class 0 OID 0)
-- Dependencies: 245
-- Name: allowed_teams_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lmslocal_prod_user
--

ALTER SEQUENCE public.allowed_teams_id_seq OWNED BY public.allowed_teams.id;


--
-- TOC entry 216 (class 1259 OID 20643)
-- Name: app_user; Type: TABLE; Schema: public; Owner: lmslocal_prod_user
--

CREATE TABLE public.app_user (
    id integer NOT NULL,
    email character varying(255),
    phone character varying(20),
    display_name character varying(100) NOT NULL,
    password_hash character varying(255),
    is_managed boolean DEFAULT false,
    created_by_user_id integer,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    last_active_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    email_verified boolean DEFAULT false,
    auth_token character varying(255),
    auth_token_expires timestamp with time zone,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    user_type character varying(50)
);


ALTER TABLE public.app_user OWNER TO lmslocal_prod_user;

--
-- TOC entry 215 (class 1259 OID 20642)
-- Name: app_user_id_seq; Type: SEQUENCE; Schema: public; Owner: lmslocal_prod_user
--

CREATE SEQUENCE public.app_user_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.app_user_id_seq OWNER TO lmslocal_prod_user;

--
-- TOC entry 3616 (class 0 OID 0)
-- Dependencies: 215
-- Name: app_user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lmslocal_prod_user
--

ALTER SEQUENCE public.app_user_id_seq OWNED BY public.app_user.id;


--
-- TOC entry 238 (class 1259 OID 20811)
-- Name: audit_log; Type: TABLE; Schema: public; Owner: lmslocal_prod_user
--

CREATE TABLE public.audit_log (
    id integer NOT NULL,
    competition_id integer,
    user_id integer NOT NULL,
    action text NOT NULL,
    details text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.audit_log OWNER TO lmslocal_prod_user;

--
-- TOC entry 237 (class 1259 OID 20810)
-- Name: audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: lmslocal_prod_user
--

CREATE SEQUENCE public.audit_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.audit_log_id_seq OWNER TO lmslocal_prod_user;

--
-- TOC entry 3617 (class 0 OID 0)
-- Dependencies: 237
-- Name: audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lmslocal_prod_user
--

ALTER SEQUENCE public.audit_log_id_seq OWNED BY public.audit_log.id;


--
-- TOC entry 226 (class 1259 OID 20717)
-- Name: competition; Type: TABLE; Schema: public; Owner: lmslocal_prod_user
--

CREATE TABLE public.competition (
    id integer NOT NULL,
    team_list_id integer NOT NULL,
    name character varying(200) NOT NULL,
    description text,
    logo_url character varying(500),
    status character varying(50) DEFAULT 'setup'::character varying NOT NULL,
    lives_per_player integer DEFAULT 1,
    no_team_twice boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    organiser_id integer,
    invite_code character varying(20),
    slug character varying(50)
);


ALTER TABLE public.competition OWNER TO lmslocal_prod_user;

--
-- TOC entry 225 (class 1259 OID 20716)
-- Name: competition_id_seq; Type: SEQUENCE; Schema: public; Owner: lmslocal_prod_user
--

CREATE SEQUENCE public.competition_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.competition_id_seq OWNER TO lmslocal_prod_user;

--
-- TOC entry 3618 (class 0 OID 0)
-- Dependencies: 225
-- Name: competition_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lmslocal_prod_user
--

ALTER SEQUENCE public.competition_id_seq OWNED BY public.competition.id;


--
-- TOC entry 228 (class 1259 OID 20737)
-- Name: competition_user; Type: TABLE; Schema: public; Owner: lmslocal_prod_user
--

CREATE TABLE public.competition_user (
    id integer NOT NULL,
    competition_id integer NOT NULL,
    user_id integer NOT NULL,
    status character varying(50) DEFAULT 'active'::character varying NOT NULL,
    lives_remaining integer DEFAULT 1,
    joined_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.competition_user OWNER TO lmslocal_prod_user;

--
-- TOC entry 227 (class 1259 OID 20736)
-- Name: competition_user_id_seq; Type: SEQUENCE; Schema: public; Owner: lmslocal_prod_user
--

CREATE SEQUENCE public.competition_user_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.competition_user_id_seq OWNER TO lmslocal_prod_user;

--
-- TOC entry 3619 (class 0 OID 0)
-- Dependencies: 227
-- Name: competition_user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lmslocal_prod_user
--

ALTER SEQUENCE public.competition_user_id_seq OWNED BY public.competition_user.id;


--
-- TOC entry 232 (class 1259 OID 20769)
-- Name: fixture; Type: TABLE; Schema: public; Owner: lmslocal_prod_user
--

CREATE TABLE public.fixture (
    id integer NOT NULL,
    round_id integer NOT NULL,
    kickoff_time timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    home_team character varying(100),
    away_team character varying(100),
    home_team_short character varying(20),
    away_team_short character varying(20),
    result character varying(100),
    processed timestamp with time zone
);


ALTER TABLE public.fixture OWNER TO lmslocal_prod_user;

--
-- TOC entry 231 (class 1259 OID 20768)
-- Name: fixture_id_seq; Type: SEQUENCE; Schema: public; Owner: lmslocal_prod_user
--

CREATE SEQUENCE public.fixture_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.fixture_id_seq OWNER TO lmslocal_prod_user;

--
-- TOC entry 3620 (class 0 OID 0)
-- Dependencies: 231
-- Name: fixture_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lmslocal_prod_user
--

ALTER SEQUENCE public.fixture_id_seq OWNED BY public.fixture.id;


--
-- TOC entry 236 (class 1259 OID 20795)
-- Name: invitation; Type: TABLE; Schema: public; Owner: lmslocal_prod_user
--

CREATE TABLE public.invitation (
    id integer NOT NULL,
    competition_id integer NOT NULL,
    created_by_user_id integer NOT NULL,
    invite_code character varying(20) NOT NULL,
    email character varying(255),
    max_uses integer DEFAULT 1,
    current_uses integer DEFAULT 0,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    used_at timestamp with time zone,
    used_by_user_id integer
);


ALTER TABLE public.invitation OWNER TO lmslocal_prod_user;

--
-- TOC entry 235 (class 1259 OID 20794)
-- Name: invitation_id_seq; Type: SEQUENCE; Schema: public; Owner: lmslocal_prod_user
--

CREATE SEQUENCE public.invitation_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.invitation_id_seq OWNER TO lmslocal_prod_user;

--
-- TOC entry 3621 (class 0 OID 0)
-- Dependencies: 235
-- Name: invitation_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lmslocal_prod_user
--

ALTER SEQUENCE public.invitation_id_seq OWNED BY public.invitation.id;


--
-- TOC entry 218 (class 1259 OID 20662)
-- Name: organisation; Type: TABLE; Schema: public; Owner: lmslocal_prod_user
--

CREATE TABLE public.organisation (
    id integer NOT NULL,
    name character varying(200) NOT NULL,
    slug character varying(100) NOT NULL,
    owner_user_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    is_active boolean DEFAULT true
);


ALTER TABLE public.organisation OWNER TO lmslocal_prod_user;

--
-- TOC entry 217 (class 1259 OID 20661)
-- Name: organisation_id_seq; Type: SEQUENCE; Schema: public; Owner: lmslocal_prod_user
--

CREATE SEQUENCE public.organisation_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.organisation_id_seq OWNER TO lmslocal_prod_user;

--
-- TOC entry 3622 (class 0 OID 0)
-- Dependencies: 217
-- Name: organisation_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lmslocal_prod_user
--

ALTER SEQUENCE public.organisation_id_seq OWNED BY public.organisation.id;


--
-- TOC entry 234 (class 1259 OID 20781)
-- Name: pick; Type: TABLE; Schema: public; Owner: lmslocal_prod_user
--

CREATE TABLE public.pick (
    id integer NOT NULL,
    round_id integer NOT NULL,
    user_id integer NOT NULL,
    fixture_id integer,
    outcome character varying(10),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    team character varying(100),
    set_by_admin integer
);


ALTER TABLE public.pick OWNER TO lmslocal_prod_user;

--
-- TOC entry 233 (class 1259 OID 20780)
-- Name: pick_id_seq; Type: SEQUENCE; Schema: public; Owner: lmslocal_prod_user
--

CREATE SEQUENCE public.pick_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pick_id_seq OWNER TO lmslocal_prod_user;

--
-- TOC entry 3623 (class 0 OID 0)
-- Dependencies: 233
-- Name: pick_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lmslocal_prod_user
--

ALTER SEQUENCE public.pick_id_seq OWNED BY public.pick.id;


--
-- TOC entry 244 (class 1259 OID 20982)
-- Name: player_progress; Type: TABLE; Schema: public; Owner: lmslocal_prod_user
--

CREATE TABLE public.player_progress (
    id integer NOT NULL,
    player_id integer NOT NULL,
    competition_id integer NOT NULL,
    round_id integer NOT NULL,
    fixture_id integer,
    chosen_team character varying(100),
    outcome character varying(20) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.player_progress OWNER TO lmslocal_prod_user;

--
-- TOC entry 243 (class 1259 OID 20981)
-- Name: player_progress_id_seq; Type: SEQUENCE; Schema: public; Owner: lmslocal_prod_user
--

CREATE SEQUENCE public.player_progress_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.player_progress_id_seq OWNER TO lmslocal_prod_user;

--
-- TOC entry 3624 (class 0 OID 0)
-- Dependencies: 243
-- Name: player_progress_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lmslocal_prod_user
--

ALTER SEQUENCE public.player_progress_id_seq OWNED BY public.player_progress.id;


--
-- TOC entry 230 (class 1259 OID 20755)
-- Name: round; Type: TABLE; Schema: public; Owner: lmslocal_prod_user
--

CREATE TABLE public.round (
    id integer NOT NULL,
    competition_id integer NOT NULL,
    round_number integer NOT NULL,
    lock_time timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    no_pick_processed boolean DEFAULT false
);


ALTER TABLE public.round OWNER TO lmslocal_prod_user;

--
-- TOC entry 229 (class 1259 OID 20754)
-- Name: round_id_seq; Type: SEQUENCE; Schema: public; Owner: lmslocal_prod_user
--

CREATE SEQUENCE public.round_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.round_id_seq OWNER TO lmslocal_prod_user;

--
-- TOC entry 3625 (class 0 OID 0)
-- Dependencies: 229
-- Name: round_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lmslocal_prod_user
--

ALTER SEQUENCE public.round_id_seq OWNED BY public.round.id;


--
-- TOC entry 220 (class 1259 OID 20676)
-- Name: subscription; Type: TABLE; Schema: public; Owner: lmslocal_prod_user
--

CREATE TABLE public.subscription (
    id integer NOT NULL,
    organisation_id integer NOT NULL,
    plan_type character varying(50) NOT NULL,
    status character varying(50) NOT NULL,
    stripe_subscription_id character varying(255),
    stripe_customer_id character varying(255),
    current_period_start timestamp with time zone,
    current_period_end timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.subscription OWNER TO lmslocal_prod_user;

--
-- TOC entry 219 (class 1259 OID 20675)
-- Name: subscription_id_seq; Type: SEQUENCE; Schema: public; Owner: lmslocal_prod_user
--

CREATE SEQUENCE public.subscription_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.subscription_id_seq OWNER TO lmslocal_prod_user;

--
-- TOC entry 3626 (class 0 OID 0)
-- Dependencies: 219
-- Name: subscription_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lmslocal_prod_user
--

ALTER SEQUENCE public.subscription_id_seq OWNED BY public.subscription.id;


--
-- TOC entry 240 (class 1259 OID 20824)
-- Name: system_config; Type: TABLE; Schema: public; Owner: lmslocal_prod_user
--

CREATE TABLE public.system_config (
    id integer NOT NULL,
    key character varying(100) NOT NULL,
    value text,
    description text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.system_config OWNER TO lmslocal_prod_user;

--
-- TOC entry 239 (class 1259 OID 20823)
-- Name: system_config_id_seq; Type: SEQUENCE; Schema: public; Owner: lmslocal_prod_user
--

CREATE SEQUENCE public.system_config_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.system_config_id_seq OWNER TO lmslocal_prod_user;

--
-- TOC entry 3627 (class 0 OID 0)
-- Dependencies: 239
-- Name: system_config_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lmslocal_prod_user
--

ALTER SEQUENCE public.system_config_id_seq OWNED BY public.system_config.id;


--
-- TOC entry 224 (class 1259 OID 20703)
-- Name: team; Type: TABLE; Schema: public; Owner: lmslocal_prod_user
--

CREATE TABLE public.team (
    id integer NOT NULL,
    team_list_id integer NOT NULL,
    name character varying(100) NOT NULL,
    short_name character varying(20),
    logo_url character varying(500),
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.team OWNER TO lmslocal_prod_user;

--
-- TOC entry 223 (class 1259 OID 20702)
-- Name: team_id_seq; Type: SEQUENCE; Schema: public; Owner: lmslocal_prod_user
--

CREATE SEQUENCE public.team_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.team_id_seq OWNER TO lmslocal_prod_user;

--
-- TOC entry 3628 (class 0 OID 0)
-- Dependencies: 223
-- Name: team_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lmslocal_prod_user
--

ALTER SEQUENCE public.team_id_seq OWNED BY public.team.id;


--
-- TOC entry 222 (class 1259 OID 20690)
-- Name: team_list; Type: TABLE; Schema: public; Owner: lmslocal_prod_user
--

CREATE TABLE public.team_list (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    type character varying(50) NOT NULL,
    season character varying(20),
    organisation_id integer,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.team_list OWNER TO lmslocal_prod_user;

--
-- TOC entry 221 (class 1259 OID 20689)
-- Name: team_list_id_seq; Type: SEQUENCE; Schema: public; Owner: lmslocal_prod_user
--

CREATE SEQUENCE public.team_list_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.team_list_id_seq OWNER TO lmslocal_prod_user;

--
-- TOC entry 3629 (class 0 OID 0)
-- Dependencies: 221
-- Name: team_list_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lmslocal_prod_user
--

ALTER SEQUENCE public.team_list_id_seq OWNED BY public.team_list.id;


--
-- TOC entry 242 (class 1259 OID 20838)
-- Name: user_activity; Type: TABLE; Schema: public; Owner: lmslocal_prod_user
--

CREATE TABLE public.user_activity (
    id integer NOT NULL,
    user_id integer NOT NULL,
    competition_id integer,
    details text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.user_activity OWNER TO lmslocal_prod_user;

--
-- TOC entry 241 (class 1259 OID 20837)
-- Name: user_activity_id_seq; Type: SEQUENCE; Schema: public; Owner: lmslocal_prod_user
--

CREATE SEQUENCE public.user_activity_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_activity_id_seq OWNER TO lmslocal_prod_user;

--
-- TOC entry 3630 (class 0 OID 0)
-- Dependencies: 241
-- Name: user_activity_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lmslocal_prod_user
--

ALTER SEQUENCE public.user_activity_id_seq OWNED BY public.user_activity.id;


--
-- TOC entry 3376 (class 2604 OID 21001)
-- Name: allowed_teams id; Type: DEFAULT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.allowed_teams ALTER COLUMN id SET DEFAULT nextval('public.allowed_teams_id_seq'::regclass);


--
-- TOC entry 3326 (class 2604 OID 20646)
-- Name: app_user id; Type: DEFAULT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.app_user ALTER COLUMN id SET DEFAULT nextval('public.app_user_id_seq'::regclass);


--
-- TOC entry 3367 (class 2604 OID 20814)
-- Name: audit_log id; Type: DEFAULT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.audit_log ALTER COLUMN id SET DEFAULT nextval('public.audit_log_id_seq'::regclass);


--
-- TOC entry 3347 (class 2604 OID 20720)
-- Name: competition id; Type: DEFAULT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.competition ALTER COLUMN id SET DEFAULT nextval('public.competition_id_seq'::regclass);


--
-- TOC entry 3352 (class 2604 OID 20740)
-- Name: competition_user id; Type: DEFAULT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.competition_user ALTER COLUMN id SET DEFAULT nextval('public.competition_user_id_seq'::regclass);


--
-- TOC entry 3359 (class 2604 OID 20772)
-- Name: fixture id; Type: DEFAULT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.fixture ALTER COLUMN id SET DEFAULT nextval('public.fixture_id_seq'::regclass);


--
-- TOC entry 3363 (class 2604 OID 20798)
-- Name: invitation id; Type: DEFAULT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.invitation ALTER COLUMN id SET DEFAULT nextval('public.invitation_id_seq'::regclass);


--
-- TOC entry 3332 (class 2604 OID 20665)
-- Name: organisation id; Type: DEFAULT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.organisation ALTER COLUMN id SET DEFAULT nextval('public.organisation_id_seq'::regclass);


--
-- TOC entry 3361 (class 2604 OID 20784)
-- Name: pick id; Type: DEFAULT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.pick ALTER COLUMN id SET DEFAULT nextval('public.pick_id_seq'::regclass);


--
-- TOC entry 3374 (class 2604 OID 20985)
-- Name: player_progress id; Type: DEFAULT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.player_progress ALTER COLUMN id SET DEFAULT nextval('public.player_progress_id_seq'::regclass);


--
-- TOC entry 3356 (class 2604 OID 20758)
-- Name: round id; Type: DEFAULT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.round ALTER COLUMN id SET DEFAULT nextval('public.round_id_seq'::regclass);


--
-- TOC entry 3336 (class 2604 OID 20679)
-- Name: subscription id; Type: DEFAULT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.subscription ALTER COLUMN id SET DEFAULT nextval('public.subscription_id_seq'::regclass);


--
-- TOC entry 3369 (class 2604 OID 20827)
-- Name: system_config id; Type: DEFAULT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.system_config ALTER COLUMN id SET DEFAULT nextval('public.system_config_id_seq'::regclass);


--
-- TOC entry 3343 (class 2604 OID 20706)
-- Name: team id; Type: DEFAULT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.team ALTER COLUMN id SET DEFAULT nextval('public.team_id_seq'::regclass);


--
-- TOC entry 3339 (class 2604 OID 20693)
-- Name: team_list id; Type: DEFAULT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.team_list ALTER COLUMN id SET DEFAULT nextval('public.team_list_id_seq'::regclass);


--
-- TOC entry 3372 (class 2604 OID 20841)
-- Name: user_activity id; Type: DEFAULT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.user_activity ALTER COLUMN id SET DEFAULT nextval('public.user_activity_id_seq'::regclass);


--
-- TOC entry 3460 (class 2606 OID 21004)
-- Name: allowed_teams allowed_teams_pkey; Type: CONSTRAINT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.allowed_teams
    ADD CONSTRAINT allowed_teams_pkey PRIMARY KEY (id);


--
-- TOC entry 3379 (class 2606 OID 20655)
-- Name: app_user app_user_pkey; Type: CONSTRAINT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.app_user
    ADD CONSTRAINT app_user_pkey PRIMARY KEY (id);


--
-- TOC entry 3440 (class 2606 OID 20819)
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- TOC entry 3406 (class 2606 OID 20731)
-- Name: competition competition_pkey; Type: CONSTRAINT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.competition
    ADD CONSTRAINT competition_pkey PRIMARY KEY (id);


--
-- TOC entry 3411 (class 2606 OID 20748)
-- Name: competition_user competition_user_pkey; Type: CONSTRAINT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.competition_user
    ADD CONSTRAINT competition_user_pkey PRIMARY KEY (id);


--
-- TOC entry 3422 (class 2606 OID 20776)
-- Name: fixture fixture_pkey; Type: CONSTRAINT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.fixture
    ADD CONSTRAINT fixture_pkey PRIMARY KEY (id);


--
-- TOC entry 3436 (class 2606 OID 20805)
-- Name: invitation invitation_invite_code_key; Type: CONSTRAINT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.invitation
    ADD CONSTRAINT invitation_invite_code_key UNIQUE (invite_code);


--
-- TOC entry 3438 (class 2606 OID 20803)
-- Name: invitation invitation_pkey; Type: CONSTRAINT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.invitation
    ADD CONSTRAINT invitation_pkey PRIMARY KEY (id);


--
-- TOC entry 3388 (class 2606 OID 20670)
-- Name: organisation organisation_pkey; Type: CONSTRAINT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.organisation
    ADD CONSTRAINT organisation_pkey PRIMARY KEY (id);


--
-- TOC entry 3390 (class 2606 OID 20672)
-- Name: organisation organisation_slug_key; Type: CONSTRAINT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.organisation
    ADD CONSTRAINT organisation_slug_key UNIQUE (slug);


--
-- TOC entry 3430 (class 2606 OID 20788)
-- Name: pick pick_pkey; Type: CONSTRAINT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.pick
    ADD CONSTRAINT pick_pkey PRIMARY KEY (id);


--
-- TOC entry 3458 (class 2606 OID 20988)
-- Name: player_progress player_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.player_progress
    ADD CONSTRAINT player_progress_pkey PRIMARY KEY (id);


--
-- TOC entry 3420 (class 2606 OID 20763)
-- Name: round round_pkey; Type: CONSTRAINT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.round
    ADD CONSTRAINT round_pkey PRIMARY KEY (id);


--
-- TOC entry 3395 (class 2606 OID 20685)
-- Name: subscription subscription_pkey; Type: CONSTRAINT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.subscription
    ADD CONSTRAINT subscription_pkey PRIMARY KEY (id);


--
-- TOC entry 3446 (class 2606 OID 20835)
-- Name: system_config system_config_key_key; Type: CONSTRAINT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.system_config
    ADD CONSTRAINT system_config_key_key UNIQUE (key);


--
-- TOC entry 3448 (class 2606 OID 20833)
-- Name: system_config system_config_pkey; Type: CONSTRAINT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.system_config
    ADD CONSTRAINT system_config_pkey PRIMARY KEY (id);


--
-- TOC entry 3400 (class 2606 OID 20698)
-- Name: team_list team_list_pkey; Type: CONSTRAINT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.team_list
    ADD CONSTRAINT team_list_pkey PRIMARY KEY (id);


--
-- TOC entry 3404 (class 2606 OID 20713)
-- Name: team team_pkey; Type: CONSTRAINT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.team
    ADD CONSTRAINT team_pkey PRIMARY KEY (id);


--
-- TOC entry 3466 (class 2606 OID 21006)
-- Name: allowed_teams unique_competition_user_team; Type: CONSTRAINT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.allowed_teams
    ADD CONSTRAINT unique_competition_user_team UNIQUE (competition_id, user_id, team_id);


--
-- TOC entry 3453 (class 2606 OID 20846)
-- Name: user_activity user_activity_pkey; Type: CONSTRAINT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.user_activity
    ADD CONSTRAINT user_activity_pkey PRIMARY KEY (id);


--
-- TOC entry 3461 (class 1259 OID 21009)
-- Name: idx_allowed_teams_competition; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_allowed_teams_competition ON public.allowed_teams USING btree (competition_id);


--
-- TOC entry 3462 (class 1259 OID 21007)
-- Name: idx_allowed_teams_competition_user; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_allowed_teams_competition_user ON public.allowed_teams USING btree (competition_id, user_id);


--
-- TOC entry 3463 (class 1259 OID 21010)
-- Name: idx_allowed_teams_team; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_allowed_teams_team ON public.allowed_teams USING btree (team_id);


--
-- TOC entry 3464 (class 1259 OID 21008)
-- Name: idx_allowed_teams_user; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_allowed_teams_user ON public.allowed_teams USING btree (user_id);


--
-- TOC entry 3380 (class 1259 OID 20658)
-- Name: idx_app_user_auth_token; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_app_user_auth_token ON public.app_user USING btree (auth_token);


--
-- TOC entry 3381 (class 1259 OID 20657)
-- Name: idx_app_user_display_name; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_app_user_display_name ON public.app_user USING btree (display_name);


--
-- TOC entry 3382 (class 1259 OID 20656)
-- Name: idx_app_user_email; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_app_user_email ON public.app_user USING btree (email);


--
-- TOC entry 3383 (class 1259 OID 20659)
-- Name: idx_app_user_last_active; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_app_user_last_active ON public.app_user USING btree (last_active_at);


--
-- TOC entry 3384 (class 1259 OID 20660)
-- Name: idx_app_user_managed; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_app_user_managed ON public.app_user USING btree (is_managed, created_by_user_id);


--
-- TOC entry 3441 (class 1259 OID 20820)
-- Name: idx_audit_competition; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_audit_competition ON public.audit_log USING btree (competition_id);


--
-- TOC entry 3442 (class 1259 OID 20822)
-- Name: idx_audit_created; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_audit_created ON public.audit_log USING btree (created_at);


--
-- TOC entry 3443 (class 1259 OID 20821)
-- Name: idx_audit_user; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_audit_user ON public.audit_log USING btree (user_id);


--
-- TOC entry 3412 (class 1259 OID 20749)
-- Name: idx_comp_user_competition; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_comp_user_competition ON public.competition_user USING btree (competition_id);


--
-- TOC entry 3413 (class 1259 OID 20751)
-- Name: idx_comp_user_status; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_comp_user_status ON public.competition_user USING btree (status);


--
-- TOC entry 3414 (class 1259 OID 20753)
-- Name: idx_comp_user_unique; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE UNIQUE INDEX idx_comp_user_unique ON public.competition_user USING btree (competition_id, user_id);


--
-- TOC entry 3415 (class 1259 OID 20750)
-- Name: idx_comp_user_user; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_comp_user_user ON public.competition_user USING btree (user_id);


--
-- TOC entry 3407 (class 1259 OID 20735)
-- Name: idx_competition_created; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_competition_created ON public.competition USING btree (created_at);


--
-- TOC entry 3408 (class 1259 OID 20734)
-- Name: idx_competition_status; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_competition_status ON public.competition USING btree (status);


--
-- TOC entry 3409 (class 1259 OID 20733)
-- Name: idx_competition_team_list; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_competition_team_list ON public.competition USING btree (team_list_id);


--
-- TOC entry 3423 (class 1259 OID 20779)
-- Name: idx_fixture_kickoff; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_fixture_kickoff ON public.fixture USING btree (kickoff_time);


--
-- TOC entry 3424 (class 1259 OID 20777)
-- Name: idx_fixture_round; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_fixture_round ON public.fixture USING btree (round_id);


--
-- TOC entry 3431 (class 1259 OID 20807)
-- Name: idx_invitation_code; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_invitation_code ON public.invitation USING btree (invite_code);


--
-- TOC entry 3432 (class 1259 OID 20806)
-- Name: idx_invitation_competition; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_invitation_competition ON public.invitation USING btree (competition_id);


--
-- TOC entry 3433 (class 1259 OID 20808)
-- Name: idx_invitation_email; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_invitation_email ON public.invitation USING btree (email);


--
-- TOC entry 3434 (class 1259 OID 20809)
-- Name: idx_invitation_expires; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_invitation_expires ON public.invitation USING btree (expires_at);


--
-- TOC entry 3385 (class 1259 OID 20674)
-- Name: idx_organisation_owner; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_organisation_owner ON public.organisation USING btree (owner_user_id);


--
-- TOC entry 3386 (class 1259 OID 20673)
-- Name: idx_organisation_slug; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_organisation_slug ON public.organisation USING btree (slug);


--
-- TOC entry 3425 (class 1259 OID 20792)
-- Name: idx_pick_fixture; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_pick_fixture ON public.pick USING btree (fixture_id);


--
-- TOC entry 3426 (class 1259 OID 20789)
-- Name: idx_pick_round; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_pick_round ON public.pick USING btree (round_id);


--
-- TOC entry 3427 (class 1259 OID 20793)
-- Name: idx_pick_unique; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE UNIQUE INDEX idx_pick_unique ON public.pick USING btree (round_id, user_id);


--
-- TOC entry 3428 (class 1259 OID 20790)
-- Name: idx_pick_user; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_pick_user ON public.pick USING btree (user_id);


--
-- TOC entry 3454 (class 1259 OID 20990)
-- Name: idx_player_progress_competition; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_player_progress_competition ON public.player_progress USING btree (competition_id);


--
-- TOC entry 3455 (class 1259 OID 20989)
-- Name: idx_player_progress_player; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_player_progress_player ON public.player_progress USING btree (player_id);


--
-- TOC entry 3456 (class 1259 OID 20991)
-- Name: idx_player_progress_round; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_player_progress_round ON public.player_progress USING btree (competition_id, round_id);


--
-- TOC entry 3416 (class 1259 OID 20764)
-- Name: idx_round_competition; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_round_competition ON public.round USING btree (competition_id);


--
-- TOC entry 3417 (class 1259 OID 20767)
-- Name: idx_round_lock_time; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_round_lock_time ON public.round USING btree (lock_time);


--
-- TOC entry 3418 (class 1259 OID 20765)
-- Name: idx_round_number; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_round_number ON public.round USING btree (competition_id, round_number);


--
-- TOC entry 3391 (class 1259 OID 20686)
-- Name: idx_subscription_org; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_subscription_org ON public.subscription USING btree (organisation_id);


--
-- TOC entry 3392 (class 1259 OID 20688)
-- Name: idx_subscription_status; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_subscription_status ON public.subscription USING btree (status);


--
-- TOC entry 3393 (class 1259 OID 20687)
-- Name: idx_subscription_stripe; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_subscription_stripe ON public.subscription USING btree (stripe_subscription_id);


--
-- TOC entry 3444 (class 1259 OID 20836)
-- Name: idx_system_config_key; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_system_config_key ON public.system_config USING btree (key);


--
-- TOC entry 3401 (class 1259 OID 20714)
-- Name: idx_team_list; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_team_list ON public.team USING btree (team_list_id);


--
-- TOC entry 3396 (class 1259 OID 20700)
-- Name: idx_team_list_org; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_team_list_org ON public.team_list USING btree (organisation_id);


--
-- TOC entry 3397 (class 1259 OID 20701)
-- Name: idx_team_list_season; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_team_list_season ON public.team_list USING btree (season);


--
-- TOC entry 3398 (class 1259 OID 20699)
-- Name: idx_team_list_type; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_team_list_type ON public.team_list USING btree (type);


--
-- TOC entry 3402 (class 1259 OID 20715)
-- Name: idx_team_name; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_team_name ON public.team USING btree (name);


--
-- TOC entry 3449 (class 1259 OID 20848)
-- Name: idx_user_activity_competition; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_user_activity_competition ON public.user_activity USING btree (competition_id);


--
-- TOC entry 3450 (class 1259 OID 20849)
-- Name: idx_user_activity_created; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_user_activity_created ON public.user_activity USING btree (created_at);


--
-- TOC entry 3451 (class 1259 OID 20847)
-- Name: idx_user_activity_user; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_user_activity_user ON public.user_activity USING btree (user_id);


--
-- TOC entry 2114 (class 826 OID 20641)
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO lmslocal_prod_user;


--
-- TOC entry 2113 (class 826 OID 20640)
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO lmslocal_prod_user;


-- Completed on 2025-08-30 17:58:47

--
-- PostgreSQL database dump complete
--

