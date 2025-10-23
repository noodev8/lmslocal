--
-- PostgreSQL database dump
--

-- Dumped from database version 16.10 (Ubuntu 16.10-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 17.4

-- Started on 2025-10-23 12:01:00

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
-- TOC entry 236 (class 1259 OID 20998)
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
-- TOC entry 235 (class 1259 OID 20997)
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
-- TOC entry 3683 (class 0 OID 0)
-- Dependencies: 235
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
    created_by_user_id integer,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    last_active_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    email_verified boolean DEFAULT false,
    auth_token character varying(255),
    auth_token_expires timestamp with time zone,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    user_type character varying(50),
    paid_credit integer DEFAULT 0 NOT NULL
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
-- TOC entry 3684 (class 0 OID 0)
-- Dependencies: 215
-- Name: app_user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lmslocal_prod_user
--

ALTER SEQUENCE public.app_user_id_seq OWNED BY public.app_user.id;


--
-- TOC entry 232 (class 1259 OID 20811)
-- Name: audit_log; Type: TABLE; Schema: public; Owner: lmslocal_prod_user
--

CREATE TABLE public.audit_log (
    id integer NOT NULL,
    competition_id integer,
    user_id integer,
    action text NOT NULL,
    details text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.audit_log OWNER TO lmslocal_prod_user;

--
-- TOC entry 231 (class 1259 OID 20810)
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
-- TOC entry 3685 (class 0 OID 0)
-- Dependencies: 231
-- Name: audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lmslocal_prod_user
--

ALTER SEQUENCE public.audit_log_id_seq OWNED BY public.audit_log.id;


--
-- TOC entry 222 (class 1259 OID 20717)
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
    slug character varying(50),
    venue_name character varying(100),
    address_line_1 character varying(100),
    address_line_2 character varying(100),
    city character varying(50),
    postcode character varying(20),
    phone character varying(20),
    email character varying(255),
    fixture_service boolean DEFAULT false,
    earliest_start_date timestamp with time zone,
    winner_id integer
);


ALTER TABLE public.competition OWNER TO lmslocal_prod_user;

--
-- TOC entry 3686 (class 0 OID 0)
-- Dependencies: 222
-- Name: COLUMN competition.venue_name; Type: COMMENT; Schema: public; Owner: lmslocal_prod_user
--

COMMENT ON COLUMN public.competition.venue_name IS 'Display name for the venue/organization (e.g., "Red Barn", "The Crown & Anchor") - shown in
  marketing posts to players';


--
-- TOC entry 3687 (class 0 OID 0)
-- Dependencies: 222
-- Name: COLUMN competition.address_line_1; Type: COMMENT; Schema: public; Owner: lmslocal_prod_user
--

COMMENT ON COLUMN public.competition.address_line_1 IS 'First line of pub/organiser address (e.g., street number and name)';


--
-- TOC entry 3688 (class 0 OID 0)
-- Dependencies: 222
-- Name: COLUMN competition.address_line_2; Type: COMMENT; Schema: public; Owner: lmslocal_prod_user
--

COMMENT ON COLUMN public.competition.address_line_2 IS 'Second line of address (e.g., area, district - optional)';


--
-- TOC entry 3689 (class 0 OID 0)
-- Dependencies: 222
-- Name: COLUMN competition.city; Type: COMMENT; Schema: public; Owner: lmslocal_prod_user
--

COMMENT ON COLUMN public.competition.city IS 'City or town name';


--
-- TOC entry 3690 (class 0 OID 0)
-- Dependencies: 222
-- Name: COLUMN competition.postcode; Type: COMMENT; Schema: public; Owner: lmslocal_prod_user
--

COMMENT ON COLUMN public.competition.postcode IS 'Postal code (UK format)';


--
-- TOC entry 3691 (class 0 OID 0)
-- Dependencies: 222
-- Name: COLUMN competition.phone; Type: COMMENT; Schema: public; Owner: lmslocal_prod_user
--

COMMENT ON COLUMN public.competition.phone IS 'Contact phone number for the pub/organiser';


--
-- TOC entry 3692 (class 0 OID 0)
-- Dependencies: 222
-- Name: COLUMN competition.email; Type: COMMENT; Schema: public; Owner: lmslocal_prod_user
--

COMMENT ON COLUMN public.competition.email IS 'Contact email address for the pub/organiser';


--
-- TOC entry 221 (class 1259 OID 20716)
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
-- TOC entry 3693 (class 0 OID 0)
-- Dependencies: 221
-- Name: competition_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lmslocal_prod_user
--

ALTER SEQUENCE public.competition_id_seq OWNED BY public.competition.id;


--
-- TOC entry 224 (class 1259 OID 20737)
-- Name: competition_user; Type: TABLE; Schema: public; Owner: lmslocal_prod_user
--

CREATE TABLE public.competition_user (
    id integer NOT NULL,
    competition_id integer NOT NULL,
    user_id integer NOT NULL,
    status character varying(50) DEFAULT 'active'::character varying NOT NULL,
    lives_remaining integer DEFAULT 1,
    joined_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    paid boolean DEFAULT false,
    paid_date timestamp with time zone,
    hidden boolean,
    personal_name character varying(100)
);


ALTER TABLE public.competition_user OWNER TO lmslocal_prod_user;

--
-- TOC entry 3694 (class 0 OID 0)
-- Dependencies: 224
-- Name: COLUMN competition_user.personal_name; Type: COMMENT; Schema: public; Owner: lmslocal_prod_user
--

COMMENT ON COLUMN public.competition_user.personal_name IS 'User''s personal nickname for this competition (optional)';


--
-- TOC entry 223 (class 1259 OID 20736)
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
-- TOC entry 3695 (class 0 OID 0)
-- Dependencies: 223
-- Name: competition_user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lmslocal_prod_user
--

ALTER SEQUENCE public.competition_user_id_seq OWNED BY public.competition_user.id;


--
-- TOC entry 250 (class 1259 OID 22298)
-- Name: credit_purchases; Type: TABLE; Schema: public; Owner: lmslocal_prod_user
--

CREATE TABLE public.credit_purchases (
    id integer NOT NULL,
    user_id integer NOT NULL,
    pack_type character varying(50) NOT NULL,
    credits_purchased integer NOT NULL,
    stripe_subscription_id character varying(100),
    stripe_customer_id character varying(100),
    paid_amount numeric(10,2) NOT NULL,
    promo_code_id integer,
    original_price numeric(10,2),
    discount_amount numeric(10,2),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.credit_purchases OWNER TO lmslocal_prod_user;

--
-- TOC entry 249 (class 1259 OID 22297)
-- Name: credit_purchases_id_seq; Type: SEQUENCE; Schema: public; Owner: lmslocal_prod_user
--

CREATE SEQUENCE public.credit_purchases_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.credit_purchases_id_seq OWNER TO lmslocal_prod_user;

--
-- TOC entry 3696 (class 0 OID 0)
-- Dependencies: 249
-- Name: credit_purchases_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lmslocal_prod_user
--

ALTER SEQUENCE public.credit_purchases_id_seq OWNED BY public.credit_purchases.id;


--
-- TOC entry 252 (class 1259 OID 22342)
-- Name: credit_transactions; Type: TABLE; Schema: public; Owner: lmslocal_prod_user
--

CREATE TABLE public.credit_transactions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    transaction_type character varying(50) NOT NULL,
    amount integer NOT NULL,
    competition_id integer,
    purchase_id integer,
    description text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.credit_transactions OWNER TO lmslocal_prod_user;

--
-- TOC entry 3697 (class 0 OID 0)
-- Dependencies: 252
-- Name: COLUMN credit_transactions.transaction_type; Type: COMMENT; Schema: public; Owner: lmslocal_prod_user
--

COMMENT ON COLUMN public.credit_transactions.transaction_type IS 'Type of credit movement: purchase (credits bought), deduction (player joined competition
  over free limit), expiry (batch expired after 12 months), admin_adjustment (manual admin change)';


--
-- TOC entry 251 (class 1259 OID 22341)
-- Name: credit_transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: lmslocal_prod_user
--

CREATE SEQUENCE public.credit_transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.credit_transactions_id_seq OWNER TO lmslocal_prod_user;

--
-- TOC entry 3698 (class 0 OID 0)
-- Dependencies: 251
-- Name: credit_transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lmslocal_prod_user
--

ALTER SEQUENCE public.credit_transactions_id_seq OWNED BY public.credit_transactions.id;


--
-- TOC entry 244 (class 1259 OID 21672)
-- Name: email_preference; Type: TABLE; Schema: public; Owner: lmslocal_prod_user
--

CREATE TABLE public.email_preference (
    id integer NOT NULL,
    user_id integer NOT NULL,
    competition_id integer,
    email_type character varying(50),
    enabled boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.email_preference OWNER TO lmslocal_prod_user;

--
-- TOC entry 3699 (class 0 OID 0)
-- Dependencies: 244
-- Name: TABLE email_preference; Type: COMMENT; Schema: public; Owner: lmslocal_prod_user
--

COMMENT ON TABLE public.email_preference IS 'User email notification preferences with global and per-competition
  granularity';


--
-- TOC entry 3700 (class 0 OID 0)
-- Dependencies: 244
-- Name: COLUMN email_preference.user_id; Type: COMMENT; Schema: public; Owner: lmslocal_prod_user
--

COMMENT ON COLUMN public.email_preference.user_id IS 'User who owns this preference setting';


--
-- TOC entry 3701 (class 0 OID 0)
-- Dependencies: 244
-- Name: COLUMN email_preference.competition_id; Type: COMMENT; Schema: public; Owner: lmslocal_prod_user
--

COMMENT ON COLUMN public.email_preference.competition_id IS '0 = global preference for all competitions, specific ID =
  override for that competition';


--
-- TOC entry 3702 (class 0 OID 0)
-- Dependencies: 244
-- Name: COLUMN email_preference.email_type; Type: COMMENT; Schema: public; Owner: lmslocal_prod_user
--

COMMENT ON COLUMN public.email_preference.email_type IS 'Type of email: all, pick_reminder, welcome, results';


--
-- TOC entry 3703 (class 0 OID 0)
-- Dependencies: 244
-- Name: COLUMN email_preference.enabled; Type: COMMENT; Schema: public; Owner: lmslocal_prod_user
--

COMMENT ON COLUMN public.email_preference.enabled IS 'TRUE = send emails, FALSE = suppress emails (default TRUE for
  opt-out model)';


--
-- TOC entry 243 (class 1259 OID 21671)
-- Name: email_preference_id_seq; Type: SEQUENCE; Schema: public; Owner: lmslocal_prod_user
--

CREATE SEQUENCE public.email_preference_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.email_preference_id_seq OWNER TO lmslocal_prod_user;

--
-- TOC entry 3704 (class 0 OID 0)
-- Dependencies: 243
-- Name: email_preference_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lmslocal_prod_user
--

ALTER SEQUENCE public.email_preference_id_seq OWNED BY public.email_preference.id;


--
-- TOC entry 240 (class 1259 OID 21632)
-- Name: email_queue; Type: TABLE; Schema: public; Owner: lmslocal_prod_user
--

CREATE TABLE public.email_queue (
    id integer NOT NULL,
    user_id integer NOT NULL,
    competition_id integer,
    email_type character varying(50) NOT NULL,
    scheduled_send_at timestamp with time zone NOT NULL,
    template_data jsonb NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    attempts integer DEFAULT 0,
    last_attempt_at timestamp with time zone,
    error_message text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    sent_at timestamp with time zone,
    round_id integer
);


ALTER TABLE public.email_queue OWNER TO lmslocal_prod_user;

--
-- TOC entry 3705 (class 0 OID 0)
-- Dependencies: 240
-- Name: TABLE email_queue; Type: COMMENT; Schema: public; Owner: lmslocal_prod_user
--

COMMENT ON TABLE public.email_queue IS 'Queue for scheduled and pending emails with retry logic';


--
-- TOC entry 3706 (class 0 OID 0)
-- Dependencies: 240
-- Name: COLUMN email_queue.user_id; Type: COMMENT; Schema: public; Owner: lmslocal_prod_user
--

COMMENT ON COLUMN public.email_queue.user_id IS 'User who will receive this email';


--
-- TOC entry 3707 (class 0 OID 0)
-- Dependencies: 240
-- Name: COLUMN email_queue.competition_id; Type: COMMENT; Schema: public; Owner: lmslocal_prod_user
--

COMMENT ON COLUMN public.email_queue.competition_id IS 'Related competition (NULL for non-competition emails)';


--
-- TOC entry 3708 (class 0 OID 0)
-- Dependencies: 240
-- Name: COLUMN email_queue.email_type; Type: COMMENT; Schema: public; Owner: lmslocal_prod_user
--

COMMENT ON COLUMN public.email_queue.email_type IS 'Type of email: welcome, pick_reminder, results';


--
-- TOC entry 3709 (class 0 OID 0)
-- Dependencies: 240
-- Name: COLUMN email_queue.scheduled_send_at; Type: COMMENT; Schema: public; Owner: lmslocal_prod_user
--

COMMENT ON COLUMN public.email_queue.scheduled_send_at IS 'When this email should be sent (emails processed when NOW() >=
   this time)';


--
-- TOC entry 3710 (class 0 OID 0)
-- Dependencies: 240
-- Name: COLUMN email_queue.template_data; Type: COMMENT; Schema: public; Owner: lmslocal_prod_user
--

COMMENT ON COLUMN public.email_queue.template_data IS 'JSON object with all data needed to render email template
  (captured at queue time)';


--
-- TOC entry 3711 (class 0 OID 0)
-- Dependencies: 240
-- Name: COLUMN email_queue.status; Type: COMMENT; Schema: public; Owner: lmslocal_prod_user
--

COMMENT ON COLUMN public.email_queue.status IS 'pending=waiting to send, processing=currently sending, sent=delivered,
  failed=max retries exceeded, cancelled=manually cancelled';


--
-- TOC entry 3712 (class 0 OID 0)
-- Dependencies: 240
-- Name: COLUMN email_queue.attempts; Type: COMMENT; Schema: public; Owner: lmslocal_prod_user
--

COMMENT ON COLUMN public.email_queue.attempts IS 'Number of send attempts made (max 3 before marking as failed)';


--
-- TOC entry 3713 (class 0 OID 0)
-- Dependencies: 240
-- Name: COLUMN email_queue.last_attempt_at; Type: COMMENT; Schema: public; Owner: lmslocal_prod_user
--

COMMENT ON COLUMN public.email_queue.last_attempt_at IS 'Timestamp of most recent send attempt (for debugging)';


--
-- TOC entry 3714 (class 0 OID 0)
-- Dependencies: 240
-- Name: COLUMN email_queue.error_message; Type: COMMENT; Schema: public; Owner: lmslocal_prod_user
--

COMMENT ON COLUMN public.email_queue.error_message IS 'Error details from Resend API if send failed (helps diagnose
  issues)';


--
-- TOC entry 3715 (class 0 OID 0)
-- Dependencies: 240
-- Name: COLUMN email_queue.sent_at; Type: COMMENT; Schema: public; Owner: lmslocal_prod_user
--

COMMENT ON COLUMN public.email_queue.sent_at IS 'When email was successfully sent (NULL if not sent yet)';


--
-- TOC entry 3716 (class 0 OID 0)
-- Dependencies: 240
-- Name: COLUMN email_queue.round_id; Type: COMMENT; Schema: public; Owner: lmslocal_prod_user
--

COMMENT ON COLUMN public.email_queue.round_id IS 'Round ID for pick reminder emails (NULL for non-round emails)';


--
-- TOC entry 239 (class 1259 OID 21631)
-- Name: email_queue_id_seq; Type: SEQUENCE; Schema: public; Owner: lmslocal_prod_user
--

CREATE SEQUENCE public.email_queue_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.email_queue_id_seq OWNER TO lmslocal_prod_user;

--
-- TOC entry 3717 (class 0 OID 0)
-- Dependencies: 239
-- Name: email_queue_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lmslocal_prod_user
--

ALTER SEQUENCE public.email_queue_id_seq OWNED BY public.email_queue.id;


--
-- TOC entry 242 (class 1259 OID 21651)
-- Name: email_tracking; Type: TABLE; Schema: public; Owner: lmslocal_prod_user
--

CREATE TABLE public.email_tracking (
    id integer NOT NULL,
    email_id character varying(255) NOT NULL,
    user_id integer NOT NULL,
    competition_id integer,
    email_type character varying(50) NOT NULL,
    subject character varying(255) NOT NULL,
    sent_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    opened_at timestamp with time zone,
    clicked_at timestamp with time zone,
    click_action character varying(100),
    unsubscribed_at timestamp with time zone,
    bounce_type character varying(50),
    resend_message_id character varying(255),
    resend_event_data jsonb
);


ALTER TABLE public.email_tracking OWNER TO lmslocal_prod_user;

--
-- TOC entry 3718 (class 0 OID 0)
-- Dependencies: 242
-- Name: TABLE email_tracking; Type: COMMENT; Schema: public; Owner: lmslocal_prod_user
--

COMMENT ON TABLE public.email_tracking IS 'Comprehensive email engagement tracking and analytics';


--
-- TOC entry 3719 (class 0 OID 0)
-- Dependencies: 242
-- Name: COLUMN email_tracking.email_id; Type: COMMENT; Schema: public; Owner: lmslocal_prod_user
--

COMMENT ON COLUMN public.email_tracking.email_id IS 'Our internal unique identifier (generated at queue time, embedded in
   links and headers)';


--
-- TOC entry 3720 (class 0 OID 0)
-- Dependencies: 242
-- Name: COLUMN email_tracking.click_action; Type: COMMENT; Schema: public; Owner: lmslocal_prod_user
--

COMMENT ON COLUMN public.email_tracking.click_action IS 'Which button/link was clicked for conversion tracking';


--
-- TOC entry 3721 (class 0 OID 0)
-- Dependencies: 242
-- Name: COLUMN email_tracking.resend_message_id; Type: COMMENT; Schema: public; Owner: lmslocal_prod_user
--

COMMENT ON COLUMN public.email_tracking.resend_message_id IS 'Resend service message ID for webhook correlation';


--
-- TOC entry 241 (class 1259 OID 21650)
-- Name: email_tracking_id_seq; Type: SEQUENCE; Schema: public; Owner: lmslocal_prod_user
--

CREATE SEQUENCE public.email_tracking_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.email_tracking_id_seq OWNER TO lmslocal_prod_user;

--
-- TOC entry 3722 (class 0 OID 0)
-- Dependencies: 241
-- Name: email_tracking_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lmslocal_prod_user
--

ALTER SEQUENCE public.email_tracking_id_seq OWNED BY public.email_tracking.id;


--
-- TOC entry 228 (class 1259 OID 20769)
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
    processed timestamp with time zone,
    competition_id integer,
    round_number integer,
    gameweek integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.fixture OWNER TO lmslocal_prod_user;

--
-- TOC entry 227 (class 1259 OID 20768)
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
-- TOC entry 3723 (class 0 OID 0)
-- Dependencies: 227
-- Name: fixture_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lmslocal_prod_user
--

ALTER SEQUENCE public.fixture_id_seq OWNED BY public.fixture.id;


--
-- TOC entry 238 (class 1259 OID 21532)
-- Name: fixture_load; Type: TABLE; Schema: public; Owner: lmslocal_prod_user
--

CREATE TABLE public.fixture_load (
    fixture_id integer NOT NULL,
    team_list_id integer NOT NULL,
    league character varying(255) NOT NULL,
    home_team_short character varying(255) NOT NULL,
    away_team_short character varying(255) NOT NULL,
    kickoff_time timestamp with time zone,
    home_score integer,
    away_score integer,
    results_pushed boolean DEFAULT false,
    results_pushed_at timestamp with time zone,
    gameweek integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.fixture_load OWNER TO lmslocal_prod_user;

--
-- TOC entry 3724 (class 0 OID 0)
-- Dependencies: 238
-- Name: TABLE fixture_load; Type: COMMENT; Schema: public; Owner: lmslocal_prod_user
--

COMMENT ON TABLE public.fixture_load IS 'Staging table for admin to load fixtures and results before automated
  distribution. Admin populates this table (manually or via import), then cron job processes unpushed records
  nightly to push to all subscribed competitions. Future: Build frontend admin UI for managing this staging area.';


--
-- TOC entry 237 (class 1259 OID 21531)
-- Name: fixture_load_fixture_id_seq; Type: SEQUENCE; Schema: public; Owner: lmslocal_prod_user
--

CREATE SEQUENCE public.fixture_load_fixture_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.fixture_load_fixture_id_seq OWNER TO lmslocal_prod_user;

--
-- TOC entry 3725 (class 0 OID 0)
-- Dependencies: 237
-- Name: fixture_load_fixture_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lmslocal_prod_user
--

ALTER SEQUENCE public.fixture_load_fixture_id_seq OWNED BY public.fixture_load.fixture_id;


--
-- TOC entry 230 (class 1259 OID 20781)
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
    set_by_admin integer,
    competition_id integer,
    round_number integer
);


ALTER TABLE public.pick OWNER TO lmslocal_prod_user;

--
-- TOC entry 229 (class 1259 OID 20780)
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
-- TOC entry 3726 (class 0 OID 0)
-- Dependencies: 229
-- Name: pick_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lmslocal_prod_user
--

ALTER SEQUENCE public.pick_id_seq OWNED BY public.pick.id;


--
-- TOC entry 234 (class 1259 OID 20982)
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
-- TOC entry 233 (class 1259 OID 20981)
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
-- TOC entry 3727 (class 0 OID 0)
-- Dependencies: 233
-- Name: player_progress_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lmslocal_prod_user
--

ALTER SEQUENCE public.player_progress_id_seq OWNED BY public.player_progress.id;


--
-- TOC entry 248 (class 1259 OID 21736)
-- Name: promo_code_usage; Type: TABLE; Schema: public; Owner: lmslocal_prod_user
--

CREATE TABLE public.promo_code_usage (
    id integer NOT NULL,
    promo_code_id integer NOT NULL,
    user_id integer NOT NULL,
    subscription_id integer,
    original_price numeric(10,2) NOT NULL,
    discount_amount numeric(10,2) NOT NULL,
    final_price numeric(10,2) NOT NULL,
    pack_purchased character varying(50) NOT NULL,
    campaign_source character varying(50),
    utm_source character varying(100),
    utm_medium character varying(100),
    utm_campaign character varying(100),
    ip_address inet,
    user_agent text,
    used_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.promo_code_usage OWNER TO lmslocal_prod_user;

--
-- TOC entry 247 (class 1259 OID 21735)
-- Name: promo_code_usage_id_seq; Type: SEQUENCE; Schema: public; Owner: lmslocal_prod_user
--

CREATE SEQUENCE public.promo_code_usage_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.promo_code_usage_id_seq OWNER TO lmslocal_prod_user;

--
-- TOC entry 3728 (class 0 OID 0)
-- Dependencies: 247
-- Name: promo_code_usage_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lmslocal_prod_user
--

ALTER SEQUENCE public.promo_code_usage_id_seq OWNED BY public.promo_code_usage.id;


--
-- TOC entry 246 (class 1259 OID 21714)
-- Name: promo_codes; Type: TABLE; Schema: public; Owner: lmslocal_prod_user
--

CREATE TABLE public.promo_codes (
    id integer NOT NULL,
    code character varying(50) NOT NULL,
    description text,
    discount_type character varying(20) NOT NULL,
    discount_value numeric(10,2) NOT NULL,
    applies_to_plans character varying(20)[],
    valid_from timestamp with time zone,
    valid_until timestamp with time zone,
    max_total_uses integer,
    max_uses_per_user integer DEFAULT 1,
    current_total_uses integer DEFAULT 0,
    campaign_name character varying(100),
    campaign_source character varying(50),
    active boolean DEFAULT true,
    created_by integer,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_discount_type CHECK (((discount_type)::text = ANY ((ARRAY['percentage'::character varying, 'fixed'::character varying])::text[]))),
    CONSTRAINT check_fixed_positive CHECK ((((discount_type)::text <> 'fixed'::text) OR (discount_value > (0)::numeric))),
    CONSTRAINT check_percentage_range CHECK ((((discount_type)::text <> 'percentage'::text) OR ((discount_value > (0)::numeric) AND (discount_value <= (100)::numeric))))
);


ALTER TABLE public.promo_codes OWNER TO lmslocal_prod_user;

--
-- TOC entry 245 (class 1259 OID 21713)
-- Name: promo_codes_id_seq; Type: SEQUENCE; Schema: public; Owner: lmslocal_prod_user
--

CREATE SEQUENCE public.promo_codes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.promo_codes_id_seq OWNER TO lmslocal_prod_user;

--
-- TOC entry 3729 (class 0 OID 0)
-- Dependencies: 245
-- Name: promo_codes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lmslocal_prod_user
--

ALTER SEQUENCE public.promo_codes_id_seq OWNED BY public.promo_codes.id;


--
-- TOC entry 226 (class 1259 OID 20755)
-- Name: round; Type: TABLE; Schema: public; Owner: lmslocal_prod_user
--

CREATE TABLE public.round (
    id integer NOT NULL,
    competition_id integer NOT NULL,
    round_number integer NOT NULL,
    lock_time timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.round OWNER TO lmslocal_prod_user;

--
-- TOC entry 225 (class 1259 OID 20754)
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
-- TOC entry 3730 (class 0 OID 0)
-- Dependencies: 225
-- Name: round_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lmslocal_prod_user
--

ALTER SEQUENCE public.round_id_seq OWNED BY public.round.id;


--
-- TOC entry 220 (class 1259 OID 20703)
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
-- TOC entry 219 (class 1259 OID 20702)
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
-- TOC entry 3731 (class 0 OID 0)
-- Dependencies: 219
-- Name: team_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lmslocal_prod_user
--

ALTER SEQUENCE public.team_id_seq OWNED BY public.team.id;


--
-- TOC entry 218 (class 1259 OID 20690)
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
-- TOC entry 217 (class 1259 OID 20689)
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
-- TOC entry 3732 (class 0 OID 0)
-- Dependencies: 217
-- Name: team_list_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lmslocal_prod_user
--

ALTER SEQUENCE public.team_list_id_seq OWNED BY public.team_list.id;


--
-- TOC entry 3377 (class 2604 OID 21001)
-- Name: allowed_teams id; Type: DEFAULT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.allowed_teams ALTER COLUMN id SET DEFAULT nextval('public.allowed_teams_id_seq'::regclass);


--
-- TOC entry 3341 (class 2604 OID 20646)
-- Name: app_user id; Type: DEFAULT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.app_user ALTER COLUMN id SET DEFAULT nextval('public.app_user_id_seq'::regclass);


--
-- TOC entry 3373 (class 2604 OID 20814)
-- Name: audit_log id; Type: DEFAULT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.audit_log ALTER COLUMN id SET DEFAULT nextval('public.audit_log_id_seq'::regclass);


--
-- TOC entry 3355 (class 2604 OID 20720)
-- Name: competition id; Type: DEFAULT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.competition ALTER COLUMN id SET DEFAULT nextval('public.competition_id_seq'::regclass);


--
-- TOC entry 3361 (class 2604 OID 20740)
-- Name: competition_user id; Type: DEFAULT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.competition_user ALTER COLUMN id SET DEFAULT nextval('public.competition_user_id_seq'::regclass);


--
-- TOC entry 3400 (class 2604 OID 22301)
-- Name: credit_purchases id; Type: DEFAULT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.credit_purchases ALTER COLUMN id SET DEFAULT nextval('public.credit_purchases_id_seq'::regclass);


--
-- TOC entry 3402 (class 2604 OID 22345)
-- Name: credit_transactions id; Type: DEFAULT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.credit_transactions ALTER COLUMN id SET DEFAULT nextval('public.credit_transactions_id_seq'::regclass);


--
-- TOC entry 3388 (class 2604 OID 21675)
-- Name: email_preference id; Type: DEFAULT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.email_preference ALTER COLUMN id SET DEFAULT nextval('public.email_preference_id_seq'::regclass);


--
-- TOC entry 3382 (class 2604 OID 21635)
-- Name: email_queue id; Type: DEFAULT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.email_queue ALTER COLUMN id SET DEFAULT nextval('public.email_queue_id_seq'::regclass);


--
-- TOC entry 3386 (class 2604 OID 21654)
-- Name: email_tracking id; Type: DEFAULT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.email_tracking ALTER COLUMN id SET DEFAULT nextval('public.email_tracking_id_seq'::regclass);


--
-- TOC entry 3368 (class 2604 OID 20772)
-- Name: fixture id; Type: DEFAULT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.fixture ALTER COLUMN id SET DEFAULT nextval('public.fixture_id_seq'::regclass);


--
-- TOC entry 3379 (class 2604 OID 21535)
-- Name: fixture_load fixture_id; Type: DEFAULT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.fixture_load ALTER COLUMN fixture_id SET DEFAULT nextval('public.fixture_load_fixture_id_seq'::regclass);


--
-- TOC entry 3371 (class 2604 OID 20784)
-- Name: pick id; Type: DEFAULT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.pick ALTER COLUMN id SET DEFAULT nextval('public.pick_id_seq'::regclass);


--
-- TOC entry 3375 (class 2604 OID 20985)
-- Name: player_progress id; Type: DEFAULT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.player_progress ALTER COLUMN id SET DEFAULT nextval('public.player_progress_id_seq'::regclass);


--
-- TOC entry 3398 (class 2604 OID 21739)
-- Name: promo_code_usage id; Type: DEFAULT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.promo_code_usage ALTER COLUMN id SET DEFAULT nextval('public.promo_code_usage_id_seq'::regclass);


--
-- TOC entry 3392 (class 2604 OID 21717)
-- Name: promo_codes id; Type: DEFAULT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.promo_codes ALTER COLUMN id SET DEFAULT nextval('public.promo_codes_id_seq'::regclass);


--
-- TOC entry 3366 (class 2604 OID 20758)
-- Name: round id; Type: DEFAULT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.round ALTER COLUMN id SET DEFAULT nextval('public.round_id_seq'::regclass);


--
-- TOC entry 3351 (class 2604 OID 20706)
-- Name: team id; Type: DEFAULT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.team ALTER COLUMN id SET DEFAULT nextval('public.team_id_seq'::regclass);


--
-- TOC entry 3347 (class 2604 OID 20693)
-- Name: team_list id; Type: DEFAULT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.team_list ALTER COLUMN id SET DEFAULT nextval('public.team_list_id_seq'::regclass);


--
-- TOC entry 3466 (class 2606 OID 21004)
-- Name: allowed_teams allowed_teams_pkey; Type: CONSTRAINT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.allowed_teams
    ADD CONSTRAINT allowed_teams_pkey PRIMARY KEY (id);


--
-- TOC entry 3408 (class 2606 OID 20655)
-- Name: app_user app_user_pkey; Type: CONSTRAINT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.app_user
    ADD CONSTRAINT app_user_pkey PRIMARY KEY (id);


--
-- TOC entry 3456 (class 2606 OID 20819)
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- TOC entry 3423 (class 2606 OID 20731)
-- Name: competition competition_pkey; Type: CONSTRAINT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.competition
    ADD CONSTRAINT competition_pkey PRIMARY KEY (id);


--
-- TOC entry 3429 (class 2606 OID 20748)
-- Name: competition_user competition_user_pkey; Type: CONSTRAINT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.competition_user
    ADD CONSTRAINT competition_user_pkey PRIMARY KEY (id);


--
-- TOC entry 3520 (class 2606 OID 22304)
-- Name: credit_purchases credit_purchases_pkey; Type: CONSTRAINT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.credit_purchases
    ADD CONSTRAINT credit_purchases_pkey PRIMARY KEY (id);


--
-- TOC entry 3525 (class 2606 OID 22350)
-- Name: credit_transactions credit_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.credit_transactions
    ADD CONSTRAINT credit_transactions_pkey PRIMARY KEY (id);


--
-- TOC entry 3499 (class 2606 OID 21680)
-- Name: email_preference email_preference_pkey; Type: CONSTRAINT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.email_preference
    ADD CONSTRAINT email_preference_pkey PRIMARY KEY (id);


--
-- TOC entry 3478 (class 2606 OID 21642)
-- Name: email_queue email_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.email_queue
    ADD CONSTRAINT email_queue_pkey PRIMARY KEY (id);


--
-- TOC entry 3489 (class 2606 OID 21661)
-- Name: email_tracking email_tracking_email_id_key; Type: CONSTRAINT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.email_tracking
    ADD CONSTRAINT email_tracking_email_id_key UNIQUE (email_id);


--
-- TOC entry 3491 (class 2606 OID 21659)
-- Name: email_tracking email_tracking_pkey; Type: CONSTRAINT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.email_tracking
    ADD CONSTRAINT email_tracking_pkey PRIMARY KEY (id);


--
-- TOC entry 3475 (class 2606 OID 21540)
-- Name: fixture_load fixture_load_pkey; Type: CONSTRAINT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.fixture_load
    ADD CONSTRAINT fixture_load_pkey PRIMARY KEY (fixture_id);


--
-- TOC entry 3445 (class 2606 OID 20776)
-- Name: fixture fixture_pkey; Type: CONSTRAINT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.fixture
    ADD CONSTRAINT fixture_pkey PRIMARY KEY (id);


--
-- TOC entry 3454 (class 2606 OID 20788)
-- Name: pick pick_pkey; Type: CONSTRAINT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.pick
    ADD CONSTRAINT pick_pkey PRIMARY KEY (id);


--
-- TOC entry 3464 (class 2606 OID 20988)
-- Name: player_progress player_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.player_progress
    ADD CONSTRAINT player_progress_pkey PRIMARY KEY (id);


--
-- TOC entry 3516 (class 2606 OID 21744)
-- Name: promo_code_usage promo_code_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.promo_code_usage
    ADD CONSTRAINT promo_code_usage_pkey PRIMARY KEY (id);


--
-- TOC entry 3509 (class 2606 OID 21731)
-- Name: promo_codes promo_codes_code_key; Type: CONSTRAINT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.promo_codes
    ADD CONSTRAINT promo_codes_code_key UNIQUE (code);


--
-- TOC entry 3511 (class 2606 OID 21729)
-- Name: promo_codes promo_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.promo_codes
    ADD CONSTRAINT promo_codes_pkey PRIMARY KEY (id);


--
-- TOC entry 3443 (class 2606 OID 20763)
-- Name: round round_pkey; Type: CONSTRAINT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.round
    ADD CONSTRAINT round_pkey PRIMARY KEY (id);


--
-- TOC entry 3417 (class 2606 OID 20698)
-- Name: team_list team_list_pkey; Type: CONSTRAINT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.team_list
    ADD CONSTRAINT team_list_pkey PRIMARY KEY (id);


--
-- TOC entry 3421 (class 2606 OID 20713)
-- Name: team team_pkey; Type: CONSTRAINT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.team
    ADD CONSTRAINT team_pkey PRIMARY KEY (id);


--
-- TOC entry 3473 (class 2606 OID 21006)
-- Name: allowed_teams unique_competition_user_team; Type: CONSTRAINT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.allowed_teams
    ADD CONSTRAINT unique_competition_user_team UNIQUE (competition_id, user_id, team_id);


--
-- TOC entry 3504 (class 2606 OID 21684)
-- Name: email_preference unique_user_competition_email_type; Type: CONSTRAINT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.email_preference
    ADD CONSTRAINT unique_user_competition_email_type UNIQUE (user_id, competition_id, email_type);


--
-- TOC entry 3518 (class 2606 OID 21746)
-- Name: promo_code_usage unique_user_promo; Type: CONSTRAINT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.promo_code_usage
    ADD CONSTRAINT unique_user_promo UNIQUE (promo_code_id, user_id);


--
-- TOC entry 3467 (class 1259 OID 21044)
-- Name: idx_allowed_teams_comp_user; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_allowed_teams_comp_user ON public.allowed_teams USING btree (competition_id, user_id);


--
-- TOC entry 3468 (class 1259 OID 21009)
-- Name: idx_allowed_teams_competition; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_allowed_teams_competition ON public.allowed_teams USING btree (competition_id);


--
-- TOC entry 3469 (class 1259 OID 21007)
-- Name: idx_allowed_teams_competition_user; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_allowed_teams_competition_user ON public.allowed_teams USING btree (competition_id, user_id);


--
-- TOC entry 3470 (class 1259 OID 21010)
-- Name: idx_allowed_teams_team; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_allowed_teams_team ON public.allowed_teams USING btree (team_id);


--
-- TOC entry 3471 (class 1259 OID 21008)
-- Name: idx_allowed_teams_user; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_allowed_teams_user ON public.allowed_teams USING btree (user_id);


--
-- TOC entry 3409 (class 1259 OID 20658)
-- Name: idx_app_user_auth_token; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_app_user_auth_token ON public.app_user USING btree (auth_token);


--
-- TOC entry 3410 (class 1259 OID 20657)
-- Name: idx_app_user_display_name; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_app_user_display_name ON public.app_user USING btree (display_name);


--
-- TOC entry 3411 (class 1259 OID 20656)
-- Name: idx_app_user_email; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_app_user_email ON public.app_user USING btree (email);


--
-- TOC entry 3412 (class 1259 OID 20659)
-- Name: idx_app_user_last_active; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_app_user_last_active ON public.app_user USING btree (last_active_at);


--
-- TOC entry 3457 (class 1259 OID 20820)
-- Name: idx_audit_competition; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_audit_competition ON public.audit_log USING btree (competition_id);


--
-- TOC entry 3458 (class 1259 OID 20822)
-- Name: idx_audit_created; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_audit_created ON public.audit_log USING btree (created_at);


--
-- TOC entry 3459 (class 1259 OID 20821)
-- Name: idx_audit_user; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_audit_user ON public.audit_log USING btree (user_id);


--
-- TOC entry 3430 (class 1259 OID 20749)
-- Name: idx_comp_user_competition; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_comp_user_competition ON public.competition_user USING btree (competition_id);


--
-- TOC entry 3431 (class 1259 OID 20751)
-- Name: idx_comp_user_status; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_comp_user_status ON public.competition_user USING btree (status);


--
-- TOC entry 3432 (class 1259 OID 20753)
-- Name: idx_comp_user_unique; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE UNIQUE INDEX idx_comp_user_unique ON public.competition_user USING btree (competition_id, user_id);


--
-- TOC entry 3433 (class 1259 OID 20750)
-- Name: idx_comp_user_user; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_comp_user_user ON public.competition_user USING btree (user_id);


--
-- TOC entry 3424 (class 1259 OID 20735)
-- Name: idx_competition_created; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_competition_created ON public.competition USING btree (created_at);


--
-- TOC entry 3425 (class 1259 OID 21048)
-- Name: idx_competition_organiser; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_competition_organiser ON public.competition USING btree (organiser_id);


--
-- TOC entry 3426 (class 1259 OID 20734)
-- Name: idx_competition_status; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_competition_status ON public.competition USING btree (status);


--
-- TOC entry 3427 (class 1259 OID 20733)
-- Name: idx_competition_team_list; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_competition_team_list ON public.competition USING btree (team_list_id);


--
-- TOC entry 3434 (class 1259 OID 21050)
-- Name: idx_competition_user_comp; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_competition_user_comp ON public.competition_user USING btree (competition_id);


--
-- TOC entry 3435 (class 1259 OID 21043)
-- Name: idx_competition_user_comp_user; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_competition_user_comp_user ON public.competition_user USING btree (competition_id, user_id);


--
-- TOC entry 3436 (class 1259 OID 21049)
-- Name: idx_competition_user_lookup; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_competition_user_lookup ON public.competition_user USING btree (competition_id, user_id);


--
-- TOC entry 3437 (class 1259 OID 21042)
-- Name: idx_competition_user_paid; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_competition_user_paid ON public.competition_user USING btree (competition_id, paid);


--
-- TOC entry 3521 (class 1259 OID 22317)
-- Name: idx_credit_purchases_created_at; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_credit_purchases_created_at ON public.credit_purchases USING btree (created_at DESC);


--
-- TOC entry 3522 (class 1259 OID 22316)
-- Name: idx_credit_purchases_stripe_session; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_credit_purchases_stripe_session ON public.credit_purchases USING btree (stripe_subscription_id);


--
-- TOC entry 3523 (class 1259 OID 22315)
-- Name: idx_credit_purchases_user_id; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_credit_purchases_user_id ON public.credit_purchases USING btree (user_id);


--
-- TOC entry 3526 (class 1259 OID 22369)
-- Name: idx_credit_transactions_competition; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_credit_transactions_competition ON public.credit_transactions USING btree (competition_id);


--
-- TOC entry 3527 (class 1259 OID 22368)
-- Name: idx_credit_transactions_created_at; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_credit_transactions_created_at ON public.credit_transactions USING btree (created_at DESC);


--
-- TOC entry 3528 (class 1259 OID 22367)
-- Name: idx_credit_transactions_type; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_credit_transactions_type ON public.credit_transactions USING btree (transaction_type);


--
-- TOC entry 3529 (class 1259 OID 22366)
-- Name: idx_credit_transactions_user_id; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_credit_transactions_user_id ON public.credit_transactions USING btree (user_id);


--
-- TOC entry 3500 (class 1259 OID 21682)
-- Name: idx_email_prefs_competition; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_email_prefs_competition ON public.email_preference USING btree (competition_id);


--
-- TOC entry 3501 (class 1259 OID 21685)
-- Name: idx_email_prefs_lookup; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_email_prefs_lookup ON public.email_preference USING btree (user_id, competition_id, email_type);


--
-- TOC entry 3502 (class 1259 OID 21681)
-- Name: idx_email_prefs_user; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_email_prefs_user ON public.email_preference USING btree (user_id);


--
-- TOC entry 3479 (class 1259 OID 21648)
-- Name: idx_email_queue_attempts; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_email_queue_attempts ON public.email_queue USING btree (attempts) WHERE ((status)::text = 'pending'::text);


--
-- TOC entry 3480 (class 1259 OID 21646)
-- Name: idx_email_queue_competition; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_email_queue_competition ON public.email_queue USING btree (competition_id);


--
-- TOC entry 3481 (class 1259 OID 21649)
-- Name: idx_email_queue_processing; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_email_queue_processing ON public.email_queue USING btree (status, scheduled_send_at, attempts) WHERE ((status)::text = 'pending'::text);


--
-- TOC entry 3482 (class 1259 OID 21699)
-- Name: idx_email_queue_round; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_email_queue_round ON public.email_queue USING btree (round_id);


--
-- TOC entry 3483 (class 1259 OID 21644)
-- Name: idx_email_queue_scheduled; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_email_queue_scheduled ON public.email_queue USING btree (scheduled_send_at);


--
-- TOC entry 3484 (class 1259 OID 21643)
-- Name: idx_email_queue_status; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_email_queue_status ON public.email_queue USING btree (status);


--
-- TOC entry 3485 (class 1259 OID 21647)
-- Name: idx_email_queue_type; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_email_queue_type ON public.email_queue USING btree (email_type);


--
-- TOC entry 3486 (class 1259 OID 21700)
-- Name: idx_email_queue_unique_check; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_email_queue_unique_check ON public.email_queue USING btree (user_id, competition_id, round_id, email_type);


--
-- TOC entry 3487 (class 1259 OID 21645)
-- Name: idx_email_queue_user; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_email_queue_user ON public.email_queue USING btree (user_id);


--
-- TOC entry 3492 (class 1259 OID 21663)
-- Name: idx_email_tracking_competition; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_email_tracking_competition ON public.email_tracking USING btree (competition_id);


--
-- TOC entry 3493 (class 1259 OID 21666)
-- Name: idx_email_tracking_opened; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_email_tracking_opened ON public.email_tracking USING btree (opened_at);


--
-- TOC entry 3494 (class 1259 OID 21667)
-- Name: idx_email_tracking_resend_id; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_email_tracking_resend_id ON public.email_tracking USING btree (resend_message_id);


--
-- TOC entry 3495 (class 1259 OID 21665)
-- Name: idx_email_tracking_sent; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_email_tracking_sent ON public.email_tracking USING btree (sent_at);


--
-- TOC entry 3496 (class 1259 OID 21664)
-- Name: idx_email_tracking_type; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_email_tracking_type ON public.email_tracking USING btree (email_type);


--
-- TOC entry 3497 (class 1259 OID 21662)
-- Name: idx_email_tracking_user; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_email_tracking_user ON public.email_tracking USING btree (user_id);


--
-- TOC entry 3446 (class 1259 OID 20779)
-- Name: idx_fixture_kickoff; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_fixture_kickoff ON public.fixture USING btree (kickoff_time);


--
-- TOC entry 3476 (class 1259 OID 21542)
-- Name: idx_fixture_load_team_list; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_fixture_load_team_list ON public.fixture_load USING btree (team_list_id);


--
-- TOC entry 3447 (class 1259 OID 20777)
-- Name: idx_fixture_round; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_fixture_round ON public.fixture USING btree (round_id);


--
-- TOC entry 3448 (class 1259 OID 21706)
-- Name: idx_fixture_round_result; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_fixture_round_result ON public.fixture USING btree (round_id, result);


--
-- TOC entry 3733 (class 0 OID 0)
-- Dependencies: 3448
-- Name: INDEX idx_fixture_round_result; Type: COMMENT; Schema: public; Owner: lmslocal_prod_user
--

COMMENT ON INDEX public.idx_fixture_round_result IS 'Optimize checking if any results exist for a round';


--
-- TOC entry 3449 (class 1259 OID 20792)
-- Name: idx_pick_fixture; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_pick_fixture ON public.pick USING btree (fixture_id);


--
-- TOC entry 3450 (class 1259 OID 20789)
-- Name: idx_pick_round; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_pick_round ON public.pick USING btree (round_id);


--
-- TOC entry 3451 (class 1259 OID 20793)
-- Name: idx_pick_unique; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE UNIQUE INDEX idx_pick_unique ON public.pick USING btree (round_id, user_id);


--
-- TOC entry 3452 (class 1259 OID 20790)
-- Name: idx_pick_user; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_pick_user ON public.pick USING btree (user_id);


--
-- TOC entry 3460 (class 1259 OID 20990)
-- Name: idx_player_progress_competition; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_player_progress_competition ON public.player_progress USING btree (competition_id);


--
-- TOC entry 3461 (class 1259 OID 20989)
-- Name: idx_player_progress_player; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_player_progress_player ON public.player_progress USING btree (player_id);


--
-- TOC entry 3462 (class 1259 OID 20991)
-- Name: idx_player_progress_round; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_player_progress_round ON public.player_progress USING btree (competition_id, round_id);


--
-- TOC entry 3505 (class 1259 OID 21733)
-- Name: idx_promo_codes_active; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_promo_codes_active ON public.promo_codes USING btree (active) WHERE (active = true);


--
-- TOC entry 3506 (class 1259 OID 21732)
-- Name: idx_promo_codes_code; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_promo_codes_code ON public.promo_codes USING btree (code);


--
-- TOC entry 3507 (class 1259 OID 21734)
-- Name: idx_promo_codes_valid_until; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_promo_codes_valid_until ON public.promo_codes USING btree (valid_until);


--
-- TOC entry 3512 (class 1259 OID 21747)
-- Name: idx_promo_usage_promo_id; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_promo_usage_promo_id ON public.promo_code_usage USING btree (promo_code_id);


--
-- TOC entry 3513 (class 1259 OID 21749)
-- Name: idx_promo_usage_used_at; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_promo_usage_used_at ON public.promo_code_usage USING btree (used_at);


--
-- TOC entry 3514 (class 1259 OID 21748)
-- Name: idx_promo_usage_user_id; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_promo_usage_user_id ON public.promo_code_usage USING btree (user_id);


--
-- TOC entry 3438 (class 1259 OID 21051)
-- Name: idx_round_comp_number; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_round_comp_number ON public.round USING btree (competition_id, round_number);


--
-- TOC entry 3439 (class 1259 OID 20764)
-- Name: idx_round_competition; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_round_competition ON public.round USING btree (competition_id);


--
-- TOC entry 3440 (class 1259 OID 20767)
-- Name: idx_round_lock_time; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_round_lock_time ON public.round USING btree (lock_time);


--
-- TOC entry 3441 (class 1259 OID 20765)
-- Name: idx_round_number; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_round_number ON public.round USING btree (competition_id, round_number);


--
-- TOC entry 3418 (class 1259 OID 20714)
-- Name: idx_team_list; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_team_list ON public.team USING btree (team_list_id);


--
-- TOC entry 3413 (class 1259 OID 20700)
-- Name: idx_team_list_org; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_team_list_org ON public.team_list USING btree (organisation_id);


--
-- TOC entry 3414 (class 1259 OID 20701)
-- Name: idx_team_list_season; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_team_list_season ON public.team_list USING btree (season);


--
-- TOC entry 3415 (class 1259 OID 20699)
-- Name: idx_team_list_type; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_team_list_type ON public.team_list USING btree (type);


--
-- TOC entry 3419 (class 1259 OID 20715)
-- Name: idx_team_name; Type: INDEX; Schema: public; Owner: lmslocal_prod_user
--

CREATE INDEX idx_team_name ON public.team USING btree (name);


--
-- TOC entry 3530 (class 2606 OID 22310)
-- Name: credit_purchases credit_purchases_promo_code_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.credit_purchases
    ADD CONSTRAINT credit_purchases_promo_code_id_fkey FOREIGN KEY (promo_code_id) REFERENCES public.promo_codes(id) ON DELETE SET NULL;


--
-- TOC entry 3531 (class 2606 OID 22305)
-- Name: credit_purchases credit_purchases_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.credit_purchases
    ADD CONSTRAINT credit_purchases_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_user(id) ON DELETE CASCADE;


--
-- TOC entry 3532 (class 2606 OID 22356)
-- Name: credit_transactions credit_transactions_competition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.credit_transactions
    ADD CONSTRAINT credit_transactions_competition_id_fkey FOREIGN KEY (competition_id) REFERENCES public.competition(id) ON DELETE SET NULL;


--
-- TOC entry 3533 (class 2606 OID 22361)
-- Name: credit_transactions credit_transactions_purchase_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.credit_transactions
    ADD CONSTRAINT credit_transactions_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES public.credit_purchases(id) ON DELETE SET NULL;


--
-- TOC entry 3534 (class 2606 OID 22351)
-- Name: credit_transactions credit_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lmslocal_prod_user
--

ALTER TABLE ONLY public.credit_transactions
    ADD CONSTRAINT credit_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_user(id) ON DELETE CASCADE;


--
-- TOC entry 2129 (class 826 OID 20641)
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO lmslocal_prod_user;


--
-- TOC entry 2128 (class 826 OID 20640)
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO lmslocal_prod_user;


-- Completed on 2025-10-23 12:01:02

--
-- PostgreSQL database dump complete
--

