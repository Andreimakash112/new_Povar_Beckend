require('dotenv').config(); // Подключаем dotenv для загрузки переменных окружения

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jsonwebtoken = require('jsonwebtoken');

// Читаем переменные окружения
const SECRET = process.env.SECRET; // Извлекаем секретный ключ
const URLDB = process.env.URL_DB;  // Адрес базы данных
const PORT = process.env.PORT || 9001; // Порт, указанный в .env или 9001 по умолчанию

const app = express();

// Загрузка моделей
const Card = require('./models/Card');
const Product = require('./models/Product');
const AdminData = require('./models/AdminData');
const User = require('./models/User');

// Middleware
app.use(cors());
app.use(express.json());

// Директория для выгрузки файлов
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

// Хранение файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// Доступ к статическим файлам
app.use('/uploads', express.static(uploadsDir));

// Подключение к MongoDB
mongoose.connect(URLDB, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('Подключились к MongoDB'))
 .catch((err) => console.error('Ошибка подключения к MongoDB:', err));

mongoose.connection.on('error', console.error.bind(console, 'Ошибка соединения с базой данных'));

// Роутеры

//////////////////////////////////////////////////////////////////////
// GET Карточки
app.get('/api/cards', async (req, res) => {
  try {
    const cards = await Card.find();
    res.json(cards);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Ошибка при получении карточек' });
  }
});

// POST Новая карточка
app.post('/api/cards', upload.single('image'), async (req, res) => {
  try {
    const { title } = req.body;
    if (!title || !req.file) {
      return res.status(400).json({ message: 'Необходимо заполнить все поля!' });
    }
    const imagePath = `/uploads/${req.file.filename}`;

    const newCard = new Card({ title, image: imagePath });
    const savedCard = await newCard.save();

    res.status(201).json(savedCard);
  } catch (error) {
    console.error(error);
    res.status(400).json({ message: 'Ошибка при создании карточки' });
  }
});

// DELETE Удаление карточки
app.delete('/api/cards/:id', async (req, res) => {
  try {
    const deletedCard = await Card.findByIdAndDelete(req.params.id);
    if (deletedCard) {
      fs.unlink(path.join(uploadsDir, deletedCard.image.split('/')[2]), (err) => {
        if (err) console.error(err);
      });
      await Product.deleteMany({ cardId: req.params.id });
      res.json({ message: 'Карточка удалена' });
    } else {
      res.status(404).json({ message: 'Карточка не найдена' });
    }
  } catch (error) {
    res.status(400).json({ message: 'Ошибка при удалении карточки' });
  }
});

// GET Список товаров
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка при получении продуктов' });
  }
});

// POST Новый товар
app.post('/api/products', async (req, res) => {
  const { title, description, price, cardId } = req.body;

  if (!title || !description || !price || !cardId) {
    return res.status(400).json({ message: 'Все поля обязательны!' });
  }

  try {
    const newProduct = new Product({ title, description, price, cardId });
    const savedProduct = await newProduct.save();
    res.status(201).json(savedProduct);
  } catch (error) {
    res.status(400).json({ message: 'Ошибка при сохранении продукта' });
  }
});

// DELETE Удаление товара
app.delete('/api/products/:id', async (req, res) => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);
    if (deletedProduct) {
      res.json({ message: 'Продукт удалён' });
    } else {
      res.status(404).json({ message: 'Продукт не найден' });
    }
  } catch (error) {
    res.status(400).json({ message: 'Ошибка при удалении продукта' });
  }
});

// Функция генерации JWT токена
function generateAccessToken(id, login, password, email, userstatus) {
  const payload = {
    id, login, password, email, userstatus
  };
  return jsonwebtoken.sign(payload, SECRET, { expiresIn: '24h' });
}

// Регистрация пользователя
app.post('/registration', async (req, res) => {
  try {
    const { login, password, email, userstatus } = req.body;

    const existingUserByLogin = await User.findOne({ login });
    if (existingUserByLogin) {
      return res.status(400).json({ error: 'Логин уже занят!' });
    }

    const user = new User({ login, password, email, userstatus });
    await user.save();
    const token = generateAccessToken(user._id, user.login, user.password, user.email, user.userstatus);
    res.json({
      message: 'Вы успешно зарегистрированы!',
      token
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Изменение пароля
app.post('/user/newPassword', async (req, res) => {
  const { token, password } = req.body;
  let user;

  try {
    user = await User.findOneAndUpdate(
      { login: jsonwebtoken.verify(token, SECRET).login },
      { password },
      { returnOriginal: false }
    );

    if (user === null) {
      res.json({ message: 'Пользователь отсутствует в базе.' }).status(400);
    }
  } catch (err) {
    res.json({ message: 'Неизвестная ошибка.' }).status(500);
    return;
  }

  res.json({ message: 'Пароль изменён! выйдите и зайдите под новым паролем' });
});

// Авторизация
app.post('/login', async (req, res) => {
  const { login, password } = req.body;
  const user = await User.findOne({ login });

  if (!user) {
    return res.status(400).json({ message: 'Пользователь не найден' });
  }

  if (user.password !== password) {
    return res.status(400).json({ message: 'Неверный логин или пароль' });
  }

  const token = generateAccessToken(user._id, user.login, user.password, user.email, user.userstatus);
  res.json({
    message: 'Вы успешно авторизованы!!!',
    token
  });
});

// Получение данных администратора
app.get('/api/data/:orgId', async (req, res) => {
  try {
    const adminData = await AdminData.findOne({ orgId: req.params.orgId });
    if (adminData) {
      res.json(adminData);
    } else {
      res.status(404).json({ message: 'Данные не найдены' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Ошибка при получении данных' });
  }
});

// Редактирование данных администратора
app.post('/api/data/:orgId', async (req, res) => {
  try {
    const { name, address, location, phone, email } = req.body;

    if (!name || !address || !location || !phone || !email) {
      return res.status(400).json({ message: 'Все поля обязательны' });
    }

    const updatedData = await AdminData.findOneAndUpdate(
      { orgId: req.params.orgId },
      { name, address, location, phone, email },
      { upsert: true, new: true }
    );

    res.json(updatedData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Ошибка при сохранении данных' });
  }
});

// Запуск сервера
app.listen(PORT,() => {
  console.log(`Сервер запущен на порту ${PORT}`);
});