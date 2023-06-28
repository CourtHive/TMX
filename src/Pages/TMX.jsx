import tmxLogo from "assets/images/orgLogo.png";
import React from "react";

import {
  SPLASH,
  TOURNAMENTS_TABLE,
  TOURNAMENTS_CONTROL,
  TMX_CONTENT,
  TMX_TOURNAMENTS,
  TMX_DRAWER,
  TIMEPICKER,
  TIMEVALUE,
  NONE,
  OVERLAY_CONTENT,
  TOURNAMENT_CONTAINER,
  EVENTS_CONTROL,
  ENTRIES_VIEW,
  TOURNAMENTS_CALENDAR,
  TOURNAMENT_EVENTS,
  NAVBAR,
  EVENTS_TABLE,
  ACCEPTED_PANEL,
  ALTERNATES_PANEL,
  QUALIFYING_PANEL,
  UNGROUPED_PANEL,
  WITHDRAWN_PANEL,
  DRAWS_VIEW,
  EVENT_INFO,
  EVENT_CONTROL,
  TMX_OVERLAY,
  TMX_PANEL,
  TOURNAMENT_OVERVIEW,
} from "constants/tmxConstants";

const TMXlogo = (
  <img
    src={tmxLogo}
    style={{ width: "100%", maxWidth: "800px" }}
    alt={"tmxLogo"}
  />
);

const tmxPanelBlock = `tableClass block ${TMX_PANEL}`;
const tournamentInfo = (
  <div id="o-tab" className="is-marginless" style={{ width: "inherit" }}>
    <div className="tab_section events_tab">
      <div className="section" style={{ paddingTop: "1em" }}>
        <div id={TOURNAMENT_OVERVIEW} className="box tournament-information">
        </div>
      </div>
    </div>
  </div>
);
const eventsTab = (
  <div id="e-tab" className="is-marginless" style={{ width: "inherit" }}>
    <div className="tab_section events_tab">
      <div className="section" style={{ paddingTop: "1em" }}>
        <div
          id={EVENT_INFO}
          className="block"
          style={{ display: NONE, width: "100%" }}
        >
          <div
            id={EVENT_CONTROL}
            className="controlBar"
            style={{ minHeight: "3em", borderRadius: "6px" }}
          ></div>
        </div>
        <div id={EVENTS_TABLE}>
          <div id={EVENTS_CONTROL} className="controlBar"></div>
          <div id={TOURNAMENT_EVENTS} className="tableClass flexcol flexcenter">
            {" "}
          </div>
        </div>
        <div id={ENTRIES_VIEW} style={{ display: NONE }}>
          <div id={ACCEPTED_PANEL} className={tmxPanelBlock}> {" "} </div>
          <div id={QUALIFYING_PANEL} className={tmxPanelBlock}> {" "} </div>
          <div id={ALTERNATES_PANEL} className={tmxPanelBlock}> {" "} </div>
          <div id={UNGROUPED_PANEL} className={tmxPanelBlock}> {" "} </div>
          <div id={WITHDRAWN_PANEL} className={tmxPanelBlock}> {" "} </div>
        </div>
        <div
          id={DRAWS_VIEW}
          style={{
            backgroundColor: "white",
            padding: "1em",
            display: NONE,
            overflowX: "scroll",
          }}
        ></div>
      </div>
    </div>
  </div>
);

const navbar = (
  <nav
    style={{ width: "100%", display: NONE }}
    className="navbar is-transparent"
    aria-label="main navigation"
    role="navigation"
    id={NAVBAR}
  >
    <div className="navbar-brand">
      <div className="navbar-item" id="tournamentName"></div>
      <div className="navbar-item" id="authorizeActions"></div>
      <a
        data-target="navbarBasicExample"
        className="navbar-burger"
        aria-expanded="false"
        aria-label="menu"
        role="button"
      >
        <span aria-hidden="true"></span>
        <span aria-hidden="true"></span>
        <span aria-hidden="true"></span>
      </a>
    </div>

    <div id="navbar-menu" className="navbar-menu">
      <div className="navbar-end">
        <div className="navbar-item">
          <figure className="image">
            <img className="is-rounded" src="" alt="" />
          </figure>
        </div>
        <div className="navbar-item">
          <div className="buttons"></div>
        </div>
      </div>
    </div>
  </nav>
);

const footer = (
  <footer className="footer" style={{ width: "100%" }}>
    <nav className="level">
      <div className="level-left"></div>
      <div className="level-right" style={{ marginRight: "1em" }}>
        <div className="level-item">
          <img className="tmxLogo" src={tmxLogo} />
        </div>
      </div>
    </nav>
  </footer>
);

if (footer) {
  //
}

const TMX = () => (
  <div>
    <div id={TIMEPICKER} style={{ display: NONE }}> <input id={TIMEVALUE} type="text" className="timepicker-ui-input" /> </div>
    <div id={TMX_OVERLAY} className="overlay" style={{ display: NONE}}>
      <a className="closebtn">&times;</a>
      <div id={OVERLAY_CONTENT} className="overlay-content"></div>
    </div>
    <section id={TMX_DRAWER} className="drawer drawer--left" data-drawer-target>
      <div className="drawer__overlay" data-drawer-close tabIndex="-1"></div>
      <div className="drawer__wrapper">
        <div className="drawer__header">
          <div className="drawer__title">Title</div>
          <button
            className="drawer__close"
            style={{ outline: NONE }}
            data-drawer-close
            aria-label="Close Drawer"
          ></button>
        </div>
        <div className="drawer__content"></div>
        <div className="drawer__footer"></div>
      </div>
    </section>
    <div className="main noselect">
      <div
        id={SPLASH}
        className="flexrow flexcenter"
        style={{ marginTop: "2em", paddingTop: "5em", display: NONE }}
      >
        {" "}
        {TMXlogo}{" "}
      </div>
      <div
        id={TMX_CONTENT}
        className="springboard flexrow flexcenter"
        style={{ display: NONE }}
      >
        <div id="sideNav" className="sideNav"></div>
        <div
          id={TOURNAMENT_CONTAINER}
          className="flexcol flexcenter tournament_container"
        >
          {navbar}
          {tournamentInfo}
          {eventsTab}
        </div>
      </div>
      <div
        id={TMX_TOURNAMENTS}
        className="flexcol flexgrow"
        style={{ display: NONE }}
      >
        <div
          id={TOURNAMENTS_CONTROL}
          className="controlBar flexcol flexgrow flexcenter"
        ></div>
        <div
          id={TOURNAMENTS_TABLE}
          className="flexcol flexgrow flexcenter box"
        ></div>
      </div>
      <div
        id={TOURNAMENTS_CALENDAR}
        className="flexcol flexgrow"
        style={{ display: NONE, height: '90%', width: '100%' }}
      >
      </div>
    </div>
  </div>
);

export default TMX;
