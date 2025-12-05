/********************************************
 * Convert country code → emoji flag
 ********************************************/
function getFlag(currencyCode) {
  const country = window.currencyFlags[currencyCode];
  if (!country) return "🌐";

  return country
    .toUpperCase()
    .split("")
    .map((char) => String.fromCodePoint(char.charCodeAt(0) + 127397))
    .join("");
}

/********************************************
 * Firebase Helper
 ********************************************/
async function getIdToken() {
  const user = firebase.auth().currentUser;
  if (!user) return null;
  return await user.getIdToken();
}

/********************************************
 * NAVBAR
 ********************************************/
function Navbar({ onHistory, onProfile, onLogout }) {
  return (
    <div className="navbar">
      <div className="nav-title">Currency Converter</div>
      <div className="nav-right">
        <button onClick={onHistory}>History</button>
        <button onClick={onProfile}>Profile</button>
        <button onClick={onLogout}>Logout</button>
      </div>
    </div>
  );
}

/********************************************
 * AUTH (Google + Email Login)
 ********************************************/
function Auth() {
  const [mode, setMode] = React.useState("login");

  async function emailLogin() {
    const email = loginEmail.value;
    const pass = loginPass.value;

    try {
      let userCred = await firebase.auth().signInWithEmailAndPassword(email, pass);
      let token = await userCred.user.getIdToken();

      await fetch("/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      });

      window.location.reload();
    } catch (err) {
      alert(err.message);
    }
  }

  async function googleLogin() {
    const provider = new firebase.auth.GoogleAuthProvider();

    try {
      let userCred = await firebase.auth().signInWithPopup(provider);
      let token = await userCred.user.getIdToken();

      await fetch("/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token })
      });

      window.location.reload();
    } catch (err) {
      alert(err.message);
    }
  }

  async function emailRegister() {
    const email = regEmail.value;
    const pass = regPass.value;

    try {
      await firebase.auth().createUserWithEmailAndPassword(email, pass);
      alert("Registered successfully! Please login.");
      setMode("login");
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div className="auth-box">
      {mode === "login" ? (
        <>
          <h3>Login</h3>
          <input id="loginEmail" placeholder="Email" />
          <input id="loginPass" type="password" placeholder="Password" />
          <button onClick={emailLogin}>Login</button>
          <button style={{ background: "#ea4335" }} onClick={googleLogin}>Login With Google</button>
          <p style={{ marginTop: 15 }}>
            New user? <span style={{ color: "#1a73e8", cursor: "pointer" }} onClick={() => setMode("register")}>Register</span>
          </p>
        </>
      ) : (
        <>
          <h3>Register</h3>
          <input id="regEmail" placeholder="Email" />
          <input id="regPass" type="password" placeholder="Password" />
          <button onClick={emailRegister}>Register</button>
          <p style={{ marginTop: 15 }}>
            Already have an account? <span style={{ color: "#1a73e8", cursor: "pointer" }} onClick={() => setMode("login")}>Login</span>
          </p>
        </>
      )}
    </div>
  );
}

/********************************************
 * PROFILE BOX
 ********************************************/
function Profile({ email }) {
  return (
    <div className="profile-card">
      <h2>Your Profile</h2>
      <p><strong>Email:</strong> {email}</p>
    </div>
  );
}

/********************************************
 * HISTORY DROPDOWN
 ********************************************/
function HistoryDropdown({ items }) {
  return (
    <div className="history-dropdown">
      <h4>Conversion History</h4>

      {items.length === 0 ? (
        <p>No history found.</p>
      ) : (
        items.map((h, i) => (
          <div key={i}>
            <p>{h.amount} {h.from} → {h.result} {h.to}</p>
            <small>{new Date(h.timestamp).toLocaleString()}</small>
            <hr />
          </div>
        ))
      )}
    </div>
  );
}

/********************************************
 * MAIN APP
 ********************************************/
function App() {
  const [currencies, setCurrencies] = React.useState({});
  const [amount, setAmount] = React.useState("");
  const [from, setFrom] = React.useState("USD");
  const [to, setTo] = React.useState("EUR");
  const [result, setResult] = React.useState("");
  const [historyVisible, setHistoryVisible] = React.useState(false);
  const [profileVisible, setProfileVisible] = React.useState(false);
  const [historyItems, setHistoryItems] = React.useState([]);
  const [email, setEmail] = React.useState("");

  // Load currencies
  React.useEffect(() => {
    fetch("https://api.frankfurter.app/currencies")
      .then(res => res.json())
      .then(data => setCurrencies(data));
  }, []);

  // Load user + history
  React.useEffect(() => {
    firebase.auth().onAuthStateChanged(async (user) => {
      if (user) {
        setEmail(user.email);

        let token = await user.getIdToken();
        let histRes = await fetch("/api/get-history", {
          headers: { Authorization: token }
        });

        const histData = await histRes.json();
        if (histData.history) setHistoryItems(histData.history);
      }
    });
  }, []);

  async function handleConvert() {
    if (!amount) return alert("Enter amount");

    let res = await fetch(
      `https://api.frankfurter.app/latest?amount=${amount}&from=${from}&to=${to}`
    );

    let data = await res.json();
    let out = data.rates[to];
    setResult(`${amount} ${from} = ${out} ${to}`);

    let token = await getIdToken();
    await fetch("/api/save-history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        from,
        to,
        amount,
        result: out,
        rate: out
      })
    });
  }

  return (
    <>
      {/* NAV */}
      <Navbar
        onHistory={() => {
          setProfileVisible(false);
          setHistoryVisible(!historyVisible);
        }}
        onProfile={() => {
          setHistoryVisible(false);
          setProfileVisible(!profileVisible);
        }}
        onLogout={async () => {
          await firebase.auth().signOut();
          window.location.reload();
        }}
      />

      {historyVisible && <HistoryDropdown items={historyItems} />}
      {profileVisible && <Profile email={email} />}

      <div className="card">
        <h2>Currency Converter</h2>

        <label>Amount</label>
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} />

        <div className="swap"><span onClick={() => { setFrom(to); setTo(from); }}>⇆</span></div>

        <label>From</label>
        <select value={from} onChange={e => setFrom(e.target.value)}>
          {Object.keys(currencies).map(c => (
            <option key={c} value={c}>{getFlag(c)} {c} - {currencies[c]}</option>
          ))}
        </select>

        <label>To</label>
        <select value={to} onChange={e => setTo(e.target.value)}>
          {Object.keys(currencies).map(c => (
            <option key={c} value={c}>{getFlag(c)} {c} - {currencies[c]}</option>
          ))}
        </select>

        <button className="convert-btn" onClick={handleConvert}>Convert</button>

        <div id="result">{result}</div>
      </div>
    </>
  );
}

/********************************************
 * LOGIN CHECK
 ********************************************/
function checkLogin() {
  firebase.auth().onAuthStateChanged(user => {
    if (!user) {
      ReactDOM.createRoot(document.getElementById("auth-root"))
        .render(<Auth />);
    } else {
      ReactDOM.createRoot(document.getElementById("auth-root"))
        .render("");
      ReactDOM.createRoot(document.getElementById("root"))
        .render(<App />);
    }
  });
}

checkLogin();

