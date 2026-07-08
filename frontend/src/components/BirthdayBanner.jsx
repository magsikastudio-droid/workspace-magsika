import { useEffect, useState, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { subscribe } from "../lib/ws";

/* Partikel confetti ringan — pure CSS + JS, tanpa library */
function Confetti() {
  const colors = ["#f472b6","#818cf8","#34d399","#fbbf24","#60a5fa","#f87171","#a78bfa"];
  const pieces = Array.from({ length: 48 }, (_, i) => ({
    id: i,
    color: colors[i % colors.length],
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 2}s`,
    duration: `${2.5 + Math.random() * 2}s`,
    size: `${8 + Math.random() * 8}px`,
    rotate: `${Math.random() * 360}deg`,
  }));

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p) => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            top: "-20px",
            left: p.left,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: Math.random() > 0.5 ? "50%" : "2px",
            transform: `rotate(${p.rotate})`,
            animation: `confettiFall ${p.duration} ${p.delay} ease-in forwards`,
            opacity: 0.9,
          }}
        />
      ))}
      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export default function BirthdayBanner() {
  const { user } = useAuth();
  const [birthdays, setBirthdays] = useState([]);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const checkedRef = useRef(false);

  /* Cek birthday saat login / mount */
  useEffect(() => {
    if (!user || checkedRef.current) return;
    checkedRef.current = true;
    api.get("/birthdays/today")
      .then((r) => {
        const list = r.data?.birthdays || [];
        if (list.length > 0) {
          setBirthdays(list);
          setVisible(true);
        }
      })
      .catch(() => {});
  }, [user]);

  /* Dengar WS "birthday" realtime */
  useEffect(() => {
    if (!user) return;
    const unsub = subscribe("birthday", (msg) => {
      const person = msg.person || "";
      setBirthdays((prev) => {
        const exists = prev.find((b) => b.birthday_person === person);
        if (exists) return prev;
        return [...prev, { birthday_person: person, title: msg.title }];
      });
      setDismissed(false);
      setVisible(true);
    });
    return unsub;
  }, [user]);

  if (!visible || dismissed || birthdays.length === 0) return null;

  const isSelf = birthdays.some(
    (b) =>
      b.birthday_person &&
      (b.birthday_person.toLowerCase() === user?.full_name?.toLowerCase() ||
        b.birthday_person.toLowerCase() === user?.username?.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm px-4">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-pink-500 to-amber-400 p-1 shadow-2xl">
        <Confetti />
        <div className="relative rounded-[22px] bg-white px-8 py-10 text-center">
          {/* Emoji besar */}
          <div className="mb-4 text-7xl animate-bounce select-none">🎂</div>

          {isSelf ? (
            <>
              <h2 className="text-2xl font-black text-slate-900">
                Selamat Ulang Tahun!
              </h2>
              <p className="mt-2 text-lg font-bold bg-gradient-to-r from-violet-600 to-pink-500 bg-clip-text text-transparent">
                {user?.full_name || user?.username}
              </p>
              <p className="mt-3 text-sm text-slate-500 leading-relaxed">
                Semua tim Magsika mengucapkan selamat ulang tahun untukmu! 🎉<br />
                Semoga panjang umur, sehat, dan sukses selalu!
              </p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-black text-slate-900">
                🎉 Hari Ulang Tahun Tim!
              </h2>
              <div className="mt-3 space-y-1">
                {birthdays.map((b, i) => (
                  <p key={i} className="text-lg font-bold bg-gradient-to-r from-violet-600 to-pink-500 bg-clip-text text-transparent">
                    {b.birthday_person}
                  </p>
                ))}
              </div>
              <p className="mt-3 text-sm text-slate-500 leading-relaxed">
                Hari ini adalah hari istimewa mereka. Yuk kirim doa dan ucapan terbaik! 🙏
              </p>
            </>
          )}

          <button
            onClick={() => setDismissed(true)}
            className="mt-6 w-full rounded-2xl bg-gradient-to-r from-violet-600 to-pink-500 py-3 text-sm font-bold text-white shadow-lg hover:opacity-90 transition"
          >
            {isSelf ? "Terima kasih! 🥳" : "Ucapkan Selamat! 🎊"}
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="mt-2 text-xs text-slate-400 hover:text-slate-600 transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
