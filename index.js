const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jsonwebtoken = require('jsonwebtoken');
const { secret } = require('./config');
const URLDB = 'mongodb://127.0.0.1:27017';

const app = express();
const PORT = 9001;

// Загружаем наши модели
const Card = require('./models/Card');
const Product = require('./models/Product');
const AdminData = require('./models/AdminData');
const User = require('./models/User');







app.use(cors());              
app.use(express.json());     


const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

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


app.use('/uploads', express.static(uploadsDir));


mongoose.connect('mongodb://localhost:27017/cardDB', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('Подключились к MongoDB'))
 .catch((err) => console.error('Ошибка подключения к MongoDB:', err));

mongoose.connection.on('error', console.error.bind(console, 'Ошибка соединения с базой данных'));



//////////////////////////////////////////////////////////////////////
app.get('/api/cards', async (req, res) => {
  try {
    const cards = await Card.find(); 
    res.json(cards); 
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Ошибка при получении карточек' });
  }
});

// Создание новой карточки //////////////////////////
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

// Удаление ///////////////////////////
app.delete('/api/cards/:id', async (req, res) => {
  try {
    const deletedCard = await Card.findByIdAndDelete(req.params.id); // Поиск и удаление карточки
    if (deletedCard) {
      //удаляю картинку///////////////
      fs.unlink(path.join(uploadsDir, deletedCard.image.split('/')[2]), (err) => {
        if (err) console.error(err);
      });

      // и все продукты карточки 
      await Product.deleteMany({ cardId: req.params.id });

      res.json({ message: 'Карточка удалена' });
    } else {
      res.status(404).json({ message: 'Карточка не найдена' });
    }
  } catch (error) {
    res.status(400).json({ message: 'Ошибка при удалении карточки' });
  }
});
////////////получаю продукты
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find(); 
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка при получении продуктов' });
  }
});

/////////////новый продукт
app.post('/api/products', async (req, res) => {
  const { title, description, price, cardId } = req.body;

  if (!title || !description || !price || !cardId) { 
    return res.status(400).json({ message: 'Все поля обязательны!' });
  }

  try {
    const newProduct = new Product({ title, description, price, cardId });
    const savedProduct = await newProduct.save(); // Сохраняем продукт в  БД
    res.status(201).json(savedProduct); 
  } catch (error) {
    res.status(400).json({ message: 'Ошибка при сохранении продукта' });
  }
});

// Удаление продукта по ID
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
/////////////////////////////////////////////////////////////////////////////////////////////

///регистрация
const generateAccessToken = (id, login, password, email, userstatus) => {
    const payload = {
        id, login, password, email, userstatus
    };
    return jsonwebtoken.sign(payload, secret, { expiresIn: '24h' });
};

app.post('/registration', async (req, res) => {
    try {
        
        const { login, password, email, userstatus } = req.body;

        
        const existingUserByLogin = await User.findOne({ login });
        if (existingUserByLogin) {
            return res.status(400).json({ error: 'Логин уже занят!' });
        }
        const existingUserByPassword = await User.findOne({ password });
        if (existingUserByPassword) {
            return res.status(400).json({ error: 'Пароль или логин  уже используется другим пользователем!' });
        }
        const user = new User({ login, password, email, userstatus });
        await user.save();
        const token = generateAccessToken(user._id, user.login, user.password, user.email, user.userstatus);
        res.json({
            message: 'Вы успешно зарегистрировались!',
            token
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

//////////////////////////////////////////////////////////////////new

function generateToken(userId) {
  return jsonwebtoken.sign(payload, secret, { expiresIn: '24h' });}



app.post('/user/newPassword', async (req, res) => {
    console.log(req.body)
    const { token, password } = req.body
    let user

    try {
        user = await User.findOneAndUpdate( { login: jsonwebtoken.verify(token, secret).login },
            {password : password   }, { returnOriginal: false })

        if (user === null) {
            res.json({
                message: 'Пользователь отсутствует в базе.'
            })
                .status(400)
        }
    } catch (err) {
        res.json({
            message: 'Неизвестная ошибка.'
        })
            .status(500)

        return
    }

    res.json({
        message: 'Пароль изменён! выйдите и зайдите под новым паролем'
       
    })
})

///////////////////////////////////////////////////////////////////
//Авторизация
app.post('/login', async (req, res) => {
    console.log(req.body)
    const { login, password } = req.body
    const user = await User.findOne({login})
    if (!user) {
        return res.status(400).json({ message: 'Пользователь не найден' })
       
    }
    if (user.password !==password  ) {
        return res.status(400).json({ message: 'Неверный логин или пароль' })
        
    }
     else {
        const token = generateAccessToken (user._id,user.login,user.password,user.email,user.userstatus )
        return res.json({
            message: 'Вы успешно авторизованы !!!',
            token: token
        })
    }
})


//Авторизация



/////////////////////////////////////////////////////////////////////////////////////////////
// Получить данные администратора по orgId
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
////////////////////////////////////////////////////////////////////////
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});