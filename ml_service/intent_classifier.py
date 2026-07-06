import re
from datetime import datetime, timedelta
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from Sastrawi.Stemmer.StemmerFactory import StemmerFactory

def parse_indonesian_date(text: str) -> str:
    text = text.lower()
    now = datetime.now()
    
    # Relative days
    if "hari ini" in text:
        return now.strftime("%Y-%m-%d")
    if "besok" in text:
        return (now + timedelta(days=1)).strftime("%Y-%m-%d")
    if "lusa" in text:
        return (now + timedelta(days=2)).strftime("%Y-%m-%d")
    if "minggu depan" in text:
        return (now + timedelta(days=7)).strftime("%Y-%m-%d")
        
    # Days of the week (next Monday, etc.)
    days_map = {
        "senin": 0, "selasa": 1, "rabu": 2, "kamis": 3,
        "jumat": 4, "sabtu": 5, "minggu": 6
    }
    
    for day_name, day_num in days_map.items():
        if f"{day_name} depan" in text:
            days_ahead = day_num - now.weekday()
            if days_ahead <= 0:
                days_ahead += 7
            return (now + timedelta(days=days_ahead)).strftime("%Y-%m-%d")
            
    # Specific months
    months_map = {
        "januari": 1, "februari": 2, "maret": 3, "april": 4,
        "mei": 5, "juni": 6, "juli": 7, "agustus": 8,
        "september": 9, "oktober": 10, "november": 11, "desember": 12,
        "jan": 1, "feb": 2, "mar": 3, "apr": 4, "jun": 6, "jul": 7,
        "agu": 8, "sep": 9, "okt": 10, "nov": 11, "des": 12
    }
    
    # Match pattern: DD Month YYYY or DD Month
    pattern_month = r'(\d{1,2})\s+([a-z]+)(\s+(\d{4}))?'
    match = re.search(pattern_month, text)
    if match:
        day = int(match.group(1))
        month_str = match.group(2)
        year = int(match.group(4)) if match.group(4) else now.year
        
        if month_str in months_map:
            month = months_map[month_str]
            try:
                parsed_date = datetime(year, month, day)
                if not match.group(4) and parsed_date < now.replace(hour=0, minute=0, second=0, microsecond=0):
                    parsed_date = parsed_date.replace(year=year + 1)
                return parsed_date.strftime("%Y-%m-%d")
            except ValueError:
                pass
                
    # Match pattern: DD/MM/YYYY or DD-MM-YYYY
    pattern_num = r'(\d{1,2})[-/](\d{1,2})([-/](\d{4}))?'
    match_num = re.search(pattern_num, text)
    if match_num:
        day = int(match_num.group(1))
        month = int(match_num.group(2))
        year = int(match_num.group(4)) if match_num.group(4) else now.year
        try:
            parsed_date = datetime(year, month, day)
            if not match_num.group(4) and parsed_date < now.replace(hour=0, minute=0, second=0, microsecond=0):
                parsed_date = parsed_date.replace(year=year + 1)
            return parsed_date.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Default to tomorrow if scheduling but no date specified
    if "jadwal" in text or "tambahkan" in text or "ingatkan" in text:
        return (now + timedelta(days=1)).strftime("%Y-%m-%d")

    return ""

def extract_task_name(text: str) -> str:
    text = text.lower()
    
    # Words to filter out
    stopwords = [
        "jadwalkan", "tambahkan", "buat", "buatkan", "tulis", "agenda", 
        "belajar", "kuis", "ujian", "tugas", "ingatkan saya", "ingatkan",
        "untuk", "pada", "tanggal", "jam", "hari ini", "besok", "lusa", "minggu depan",
        "skedulin", "skedul", "remind", "tambah", "tambahin", "buatin", "jadwalin", "dong", "tolong"
    ]
    
    # Strip date patterns
    text = re.sub(r'\d{1,2}\s+[a-z]+(\s+\d{4})?', '', text)
    text = re.sub(r'\d{1,2}[-/]\d{1,2}([-/]\d{4})?', '', text)
    
    words = text.split()
    filtered_words = [w for w in words if w not in stopwords]
    
    if not filtered_words:
        return "Tugas Cepat"
        
    return " ".join(filtered_words).strip().title()

class IntentClassifier:
    def __init__(self):
        factory = StemmerFactory()
        self.stemmer = factory.create_stemmer()
        self.pipeline = None
        self.training_data = [
            # Intent: sync_welearn
            ("sinkronkan tugas welearn sekarang", "sync_welearn"),
            ("tarik data welearn", "sync_welearn"),
            ("sync welearn", "sync_welearn"),
            ("update tugas moodle", "sync_welearn"),
            ("sinkronisasi welearn", "sync_welearn"),
            ("ambil tugas baru dari welearn", "sync_welearn"),
            ("sync welearn wicida", "sync_welearn"),
            ("sinkronkan welearn", "sync_welearn"),
            ("tarik welearn", "sync_welearn"),
            ("sinkronin welearn dong", "sync_welearn"),
            ("skronkan welearn", "sync_welearn"),
            ("tarek data welearn", "sync_welearn"),
            ("update-in tugas moodle", "sync_welearn"),
            ("singkronkan welearn", "sync_welearn"),
            ("hubungkan welearn", "sync_welearn"),
            ("konekin moodle", "sync_welearn"),
            ("ambil data moodle", "sync_welearn"),
            ("sinkronisasi welearn wicida", "sync_welearn"),
            
            # Intent: schedule_event
            ("jadwalkan kuis praktikum besok", "schedule_event"),
            ("buat agenda belajar tanggal 20 juni", "schedule_event"),
            ("tambahkan jadwal ujian minggu depan", "schedule_event"),
            ("tolong jadwalkan belajar pemrograman", "schedule_event"),
            ("ingatkan saya ada tugas besok", "schedule_event"),
            ("buat kuis baru di kalender", "schedule_event"),
            ("tambahkan tugas rekayasa web lusa", "schedule_event"),
            ("jadwalkan tugas baru", "schedule_event"),
            ("skedulin kuis besok", "schedule_event"),
            ("buat agenda belajel besok", "schedule_event"),
            ("remind tugas lusa", "schedule_event"),
            ("tolong jadwalan kuis baru", "schedule_event"),
            ("tugasin belajar pemrograman", "schedule_event"),
            ("tambahkan skedul besok", "schedule_event"),
            ("buat agenda baru", "schedule_event"),
            ("tulis agenda baru lusa", "schedule_event"),
            
            # Intent: check_deadline
            ("tampilkan tugas terlambat", "check_deadline"),
            ("apa saja tugas yang overdue?", "check_deadline"),
            ("lihat deadline terdekat", "check_deadline"),
            ("tugas apa yang harus dikumpulkan minggu ini", "check_deadline"),
            ("cek tugas yang belum selesai", "check_deadline"),
            ("apakah ada tugas yang terlambat?", "check_deadline"),
            ("tampilkan tugas yang belum dikumpul", "check_deadline"),
            ("tenggat tugas apa aja", "check_deadline"),
            ("uts apa saja yang belum dikumpul", "check_deadline"),
            ("tugas overdue apa aja", "check_deadline"),
            ("cek deadline malkut minggu ini", "check_deadline"),
            ("lihat tugas yang belum selesai", "check_deadline"),
            ("ada tugas apa aja yang deketan", "check_deadline"),
            
            # Intent: general_chat (fallback)
            ("tolong jelaskan materi ini", "general_chat"),
            ("bantu saya coding golang", "general_chat"),
            ("bagaimana cara menghitung algoritma ini?", "general_chat"),
            ("halo hermes", "general_chat"),
            ("siapa kamu?", "general_chat"),
            ("hai", "general_chat"),
            ("apa kabar?", "general_chat"),
            ("buatkan rangkuman tentang ai", "general_chat"),
            ("siapa pembuatmu?", "general_chat"),
            ("bagaimana cuaca hari ini?", "general_chat"),
            ("tolong buatin codingan", "general_chat"),
            ("bagaimana cara kerja k-means", "general_chat"),
            ("tolong jelasin materi ini", "general_chat"),
            ("bantu ngerjain soal", "general_chat"),
            ("siapa sih kamu", "general_chat"),
            ("apa kabar bro", "general_chat"),
            ("buat rangkuman tugas", "general_chat"),
            ("tanya dong", "general_chat"),
            ("bantu coding golang", "general_chat")
        ]

    def train(self):
        texts, labels = zip(*self.training_data)
        # Stem all training texts first
        stemmed_texts = [self.stemmer.stem(t) for t in texts]
        self.pipeline = Pipeline([
            ("tfidf", TfidfVectorizer(ngram_range=(1, 2), stop_words=None)),
            ("clf", LogisticRegression(solver="lbfgs", C=10.0))
        ])
        self.pipeline.fit(stemmed_texts, labels)
        print("Local intent classifier trained successfully with Indonesian Stemming!")

    def predict(self, text: str):
        if not self.pipeline:
            self.train()
        
        # Stem user query before prediction
        stemmed_text = self.stemmer.stem(text)
        prob = self.pipeline.predict_proba([stemmed_text])[0]
        max_idx = prob.argmax()
        intent = self.pipeline.classes_[max_idx]
        confidence = float(prob[max_idx])
        
        # If confidence is below threshold, fallback to general_chat
        if confidence < 0.60:
            intent = "general_chat"
            
        return intent, confidence
