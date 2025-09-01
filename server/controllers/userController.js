import userModel from "../models/userModel.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import razorpay from 'razorpay'
import transactionModel from "../models/transactionModel.js";

// ================== REGISTER ==================
const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Missing Details" });
    }

    // ✅ Check if user already exists
    const existingUser = await userModel.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, message: "User already exists" });
    }

    // ✅ Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // ✅ Create user with default credits
    const newUser = new userModel({
      name,
      email,
      password: hashedPassword,
      creditBalance: 5, // set default credits
    });

    const user = await newUser.save();

    // ✅ Generate token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    return res.status(201).json({
      success: true,
      token,
      user: { name: user.name, email: user.email },
    });
  } catch (error) {
    console.error("Register error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ================== LOGIN ==================
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // ✅ Find user
    const user = await userModel.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User does not exist" });
    }

    // ✅ Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    // ✅ Generate token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    return res.status(200).json({
      success: true,
      token,
      user: { name: user.name, email: user.email },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ================== GET USER CREDITS ==================
const userCredits = async (req, res) => {
  try {
    const userId = req.user?.id; // ✅ from middleware
    if (!userId) {
      return res.status(401).json({ success: false, message: "Not Authorized" });
    }

    const user = await userModel
      .findById(userId)
      .select("creditBalance name email");

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.status(200).json({
      success: true,
      credits: user.creditBalance,
      user: { name: user.name, email: user.email },
    });
  } catch (error) {
    console.error("Error fetching user credits:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const razorpayInstance = ({
    key_id:process.env.RAZORPAY_KEY_ID,
    key_secret:process.env.RAZORPAY_KEY_SECRET
})

const paymentRazorpay = async (req,res) =>{
    try {
        const {userId , planId} = req.body
        const userData = await userModel.findById(userId)

        if(!userId || !planId ){
           return res.json({success:false , message: "Missing Details"})
        }

        let credits , plan , amount , date

        switch (planId) {
          case 'Basic':
            plan = 'Basic'
            credits = 100
            amount = 10
            
            break;

            case 'Advanced':
            plan = 'Basic'
            credits = 500
            amount = 50
            
            break;
            case 'Business':
            plan = 'Business'
            credits = 5000
            amount = 250
            
            break;
        
          default:
            return res.json;
        }

        date = Date.now();
        const transactionData = {
          userId,plan, amount , credits , date
        }

        const newTransaction = await transactionModel.create(transactionData)


        const options = {
          amount:amount * 100,
          currency : process.env.CURRENCY,
          recipt:newTransaction._id

        }

        await razorpayInstance.orders.create(options , (error , order)=> {
          if(error){
            console.log(error);
            return res.json({success:false, message:error})
            
          }
          res.json({success:true, order})

        })

        
    } catch (error) {
        console.log(error);
        res.json({success:false , message:"Plan not found"})
    }
}


const  verifyRazorpay = async (req,res) => {
  try {

    const { razorpay_order_id} = req.body
    const orderInfo = await razorpayInstance.orders.fetch(razorpay_order_id)

    if(orderInfo.status === 'paid') {
      const transactionData = await transactionModel.findById(orderInfo.id)
      if(transactionData.payment){
         return res.json({success:false, message:'Payment Faild'})
      }

      const userData = await userModel.findById(transactionData.userId)

      const creditBalance = userData.creditBalance + transactionData.credits
      await userModel.findByIdAndUpdate(userData._id,{creditBalance})
      await transactionModel.findByIdAndUpdate(transactionData._id , {payment:true})

      res.json({success:true , message:"Credits Added"})
    } else{
      res.json({success:false , message:"Payment Faild"})
    }

    
  } catch (error) {
    console.log(error);
        res.json({success:false , message:"Plan not found"})
  }
}





export { registerUser, loginUser, userCredits , paymentRazorpay ,verifyRazorpay };
