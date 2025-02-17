import { Request, Response } from "express";
import {
  hashedPassword,
  RandomNumber,
  ReturnCode,
  ValidatePassword,
} from "../utilities/helper";
import { z } from "zod";
import User, { ROLE, UserType } from "../model/User.model";
import HandleEmail from "../utilities/email";
import bcrypt from "bcrypt";

export const UserValidate = z.object({
  body: z.object({
    email: z.string().email("Email is required"),
    password: z
      .string()
      .refine((pass) => ValidatePassword(pass), "Invalid Password"),
    role: z.nativeEnum(ROLE).optional(),
  }),
});

export async function RegisterUser(req: Request, res: Response) {
  const data = req.body as UserType;
  try {
    const isUser = await User.findOne({ email: data.email });
    if (isUser)
      return res.status(400).json(ReturnCode(400, "Email already exist"));

    const password = hashedPassword(data.password);
    await User.create({
      ...data,
      role: ROLE.USER,
      password,
    });

    return res.status(201).json(ReturnCode(201, "User registered"));
  } catch (error) {
    console.log("Register User", error);
    return res.status(500).json(ReturnCode(500));
  }
}

interface EditUser extends UserType {
  type: "vfy" | "confirm" | "edit";
  edittype: "email" | "password";
  code: string;
  newpassword: string;
}

export async function EditUser(req: Request, res: Response) {
  const edituserdata = req.body as EditUser;

  try {
    if (!edituserdata._id || !edituserdata.edittype)
      return res.status(400).json(ReturnCode(400));

    if (edituserdata.edittype === "email") {
      switch (edituserdata.type) {
        case "vfy":
          {
            let generateCode = RandomNumber(6);
            let isUnqiue = false;

            while (!isUnqiue) {
              const isCode = await User.findOne({ code: generateCode });
              if (!isCode) {
                isUnqiue = true;
              }
              generateCode = RandomNumber(6);
            }
            await User.findByIdAndUpdate(edituserdata._id, {
              code: generateCode,
            });

            //Send Code Email
            const sendemail = await HandleEmail(
              edituserdata.email,
              "Confirm Email Address",
              "Email Address Confirmation",
              ""
            );

            if (!sendemail.success) {
              return res.status(500).json(ReturnCode(500));
            }
          }
          break;
        case "confirm":
          {
            if (!edituserdata.code) {
              return res.status(400).json(ReturnCode(400));
            }
            const isUser = await User.findOne({ code: edituserdata.code });
            if (!isUser)
              return res.status(400).json(ReturnCode(400, "Invalid Code"));

            await User.findByIdAndUpdate(edituserdata._id, { code: null });
          }
          break;
        case "edit":
          {
            const updateUser = await User.findByIdAndUpdate(edituserdata._id, {
              email: edituserdata.email,
            });
            if (!updateUser) return res.status(400).json(ReturnCode(400));
          }
          break;

        default:
          break;
      }
    } else {
      const user = await User.findById(edituserdata._id);
      if (!edituserdata.password || !edituserdata.newpassword || !user)
        return res.status(400).json(ReturnCode(400));

      const isPassword = bcrypt.compareSync(
        edituserdata.password,
        user.password
      );

      if (!isPassword) return res.status(400).json(ReturnCode(400));

      const updatedPassowrd = hashedPassword(edituserdata.newpassword);

      await User.findByIdAndUpdate(edituserdata._id, {
        password: updatedPassowrd,
      });
    }

    return res.status(200).json(ReturnCode(200));
  } catch (error) {
    console.log("Edit User", error);
    return res.status(500).json(ReturnCode(500));
  }
}

export async function DeleteUser(req: Request, res: Response) {
  const id = req.body;
  try {
    if (!id) return res.status(400).json(ReturnCode(400));

    await User.findByIdAndDelete(id);
    return res.status(200).json(ReturnCode(200, "User Deleted"));
  } catch (error) {
    console.log("Delete User", error);
    return res.status(500).json(ReturnCode(500));
  }
}
