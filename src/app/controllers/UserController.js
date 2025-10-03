import bcrypt from 'bcrypt'
import UserModel from '../models/UserModel.js'

// Controller quản lý người dùng (CRUD + đổi mật khẩu)

// Lấy danh sách người dùng còn hoạt động (chưa bị xóa)
export const getAllUsers = async (req, res) => {
  try {
    // Chỉ admin mới được phép xem danh sách người dùng 
    const requester = req.user || {}
    if (!requester.roles?.includes('admin')) {
      return res.status(403).json({ success: false, message: 'Không đủ quyền' })
    }

    // Lấy danh sách người dùng chưa bị xóa, không trả về mật khẩu
    const users = await UserModel.find({ isDeleted: false }).select('-password')
    res.json({ success: true, data: users })
  } catch (error) {
    console.error('Lỗi lấy danh sách người dùng:', error)
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' })
  }
}

// Lấy chi tiết người dùng theo ID (và chưa bị xóa)
export const getUserById = async (req, res) => {
  try {
    // Chỉ admin mới được phép xem chi tiết người dùng
    const requester = req.user || {}
    if (!requester.roles?.includes('admin')) {
      return res.status(403).json({ success: false, message: 'Không đủ quyền' })
    }

    // Tìm user theo ID, không trả về mật khẩu
    const { id } = req.params
    const user = await UserModel.findOne({ _id: id, isDeleted: false }).select('-password')
    if (!user) return res.status(404).json({ 
      success: false, 
      message: 'Không tìm thấy người dùng' })
    res.json({ success: true, data: user })
  } catch (error) {
    console.error('Lỗi lấy người dùng theo ID:', error)
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' })
  }
}

// Cập nhật thông tin cơ bản; chỉ admin mới được chỉnh sửa vai trò (roles)
export const updateUser = async (req, res) => {
  // Chỉ admin mới được phép chỉnh sửa người dùng
  const requester = req.user || {}
  if (!requester.roles?.includes('admin')) {
    return res.status(403).json({ success: false, message: 'Không đủ quyền' })
  }
  try {
    // Lấy dữ liệu từ body
    const { id } = req.params
    const { username, roles, isActive } = req.body
    const rawEmail = req.body.newEmail ?? req.body.email
    const newEmail = rawEmail?.trim().toLowerCase()

    // Tìm user theo ID
    const user = await UserModel.findById(id)
    if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' })

    // Kiểm tra trùng lặp email nếu có thay đổi
    if (newEmail && newEmail !== (user.email?.trim().toLowerCase() || '')) {
      const emailExists = await UserModel.exists({ email: newEmail, _id: { $ne: id } })
      if (emailExists) return res.status(409).json({ 
        success: false, 
        message: 'Email đã tồn tại' })
      user.email = newEmail
    }

    // Cập nhật các trường khác nếu có thay đổi và hợp lệ   
    if (username) user.username = username.trim() 

    // Chỉ admin mới được phép chỉnh roles, và chỉ nhận giá trị hợp lệ  
    if (roles) {  
      const requesterRoles = req.user?.roles || []
      const allowed = ['user', 'editor', 'admin']
      const allValid = Array.isArray(roles) && roles.every(r => allowed.includes(r))

      // Chặn chỉnh sửa vai trò nếu không phải admin
      if (!requesterRoles.includes('admin')) {
        return res.status(403).json({ 
          success: false, 
          message: 'Không đủ quyền chỉnh sửa vai trò' })
      }

      // Kiểm tra tính hợp lệ của roles
      if (!allValid) return res.status(400).json({ 
        success: false, 
        message: 'Danh sách vai trò không hợp lệ' })
      user.roles = roles
    }

    // Chỉ nhận giá trị boolean cho isActive
    if (typeof isActive === 'boolean') user.isActive = isActive

    user.updatedAt = new Date()
    await user.save()
    res.json({
      success: true,
      message: 'Cập nhật người dùng thành công',
      data: { id: user._id, 
        username: user.username, 
        email: user.email, 
        roles: user.roles, 
        isActive: user.isActive },
    })
  } catch (error) {
    console.error('Lỗi cập nhật người dùng:', error)
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' })
  }
}

// Xóa người dùng: không xóa khỏi DB, chỉ đánh dấu
export const deleteUser = async (req, res) => {
  try {
    // Chỉ admin mới được phép xóa người dùng
    const requester = req.user || {}
    if (!requester.roles?.includes('admin')) {
      return res.status(403).json({ success: false, message: 'Không đủ quyền' })
    }

    // Tìm user theo ID và đánh dấu xóa
    const { id } = req.params
    const user = await UserModel.findById(id)
    if (!user) return res.status(404).json({ 
      success: false, 
      message: 'Không tìm thấy người dùng' 
    })
    user.isDeleted = true
    user.deletedAt = new Date()
    await user.save()
    res.json({ success: true, message: 'Xóa người dùng thành công' })
  } catch (error) {
    console.error('Lỗi xóa người dùng:', error)
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' })
  }
}

// Đổi mật khẩu: chỉ cho chính chủ hoặc admin; cần lấy kèm trường password
export const changePassword = async (req, res) => {
  try {
    const { id } = req.params
    const { currentPassword, newPassword } = req.body

    // Kiểm tra dữ liệu đầu vào
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Thiếu mật khẩu hiện tại hoặc mật khẩu mới' })
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Mật khẩu mới tối thiểu 6 ký tự' })
    }
    
    // Chặn người khác đổi mật khẩu nếu không phải admin
    const requester = req.user || {}
    const isAdmin = (requester.roles || []).includes('admin')
    if (!isAdmin && requester.userId !== id) {
      return res.status(403).json({ success: false, message: 'Không đủ quyền' })
    }

    // Tìm user theo ID, lấy kèm trường password
    const user = await UserModel.findById(id).select('+password')
    if (!user) return res.status(404).json({ 
      success: false, 
      message: 'Không tìm thấy người dùng' 
    })
    
        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password)

    // Nếu không phải admin thì phải kiểm tra mật khẩu hiện tại
    if (!isAdmin) {
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password)
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ success: false, message: 'Mật khẩu hiện tại không đúng' })
      }
    }
    
    // Mã hóa mật khẩu mới và lưu
    const hashedNewPassword = await bcrypt.hash(newPassword, 10)
    user.password = hashedNewPassword
    user.updatedAt = new Date()
    await user.save()
    res.json({ success: true, message: 'Đổi mật khẩu thành công' })
  } catch (error) {
    console.error('Lỗi đổi mật khẩu:', error)
    res.status(500).json({ success: false, message: 'Lỗi máy chủ' })
  }
}
