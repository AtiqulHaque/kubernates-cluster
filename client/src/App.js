import React from 'react';
import './App.css';
import { BrowserRouter as Router, Route, Switch, NavLink } from 'react-router-dom';
import OtherPage from './OtherPage';
import Fib from './Fib';
import NestData from './NestData';
import Notes from './Notes';

function App() {
  return (
    <Router>
      <div className="App">
        <div className="app-shell">
          <nav className="app-navbar">
            <NavLink to="/" className="app-brand" exact>
              <div className="app-brand-icon">F</div>
              <div className="app-brand-text">
                <span className="app-brand-title">FibFlow</span>
                <span className="app-brand-sub">Multi-service calculator</span>
              </div>
            </NavLink>
            <div className="app-nav">
              <NavLink to="/" className="app-nav-link" exact activeClassName="active">
                Calculator
              </NavLink>
              <NavLink to="/nestjs-data" className="app-nav-link" activeClassName="active">
                NestJS Data
              </NavLink>
              <NavLink to="/notes" className="app-nav-link" activeClassName="active">
                Notes
              </NavLink>
              <NavLink to="/otherpage" className="app-nav-link" activeClassName="active">
                About
              </NavLink>
            </div>
          </nav>

          <main className="app-main">
            <Switch>
              <Route exact path="/" component={Fib} />
              <Route path="/nestjs-data" component={NestData} />
              <Route path="/notes" component={Notes} />
              <Route path="/otherpage" component={OtherPage} />
            </Switch>
          </main>
        </div>

        <footer className="app-footer">
          React · Express · Redis · Postgres · NestJS · Kubernetes
        </footer>
      </div>
    </Router>
  );
}

export default App;
