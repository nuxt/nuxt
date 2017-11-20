<template>
  <div class="elm-demo">
    <el-form :model="account" :rules="formRules" ref="elm-demo" label-width="100px">
      <el-row type="flex" justify="flex-start">
        <el-col :xs="24" :sm="10">
          <el-form-item label="Account Name" prop="name" required>
            <el-input v-model="account.name"></el-input>
          </el-form-item>
        </el-col>
      </el-row>
      <el-row type="flex" justify="flex-start">
        <el-col :xs="24" :sm="10">
          <el-form-item label="Date" prop="date" required>
            <el-date-picker v-model="account.date" style="width: 100%;"></el-date-picker>
          </el-form-item>
        </el-col>
        <el-col :xs="24" :sm="{span: 3, offset: 2}">
          <el-form-item label="Subscribe" prop="subscribe">
            <el-switch on-text="" off-text="" v-model="account.subscribe"></el-switch>
          </el-form-item>
        </el-col>
      </el-row>
      <el-row type="flex" justify="flex-start">
        <el-col :xs="24" :sm="10">
          <el-form-item label="Rate" prop="rate">
            <el-rate v-model="account.rate" :colors="['#99A9BF', '#F7BA2A', '#FF9900']"></el-rate>
          </el-form-item>
        </el-col>
        <el-col :xs="24" :sm="{span: 10, offset: 2}">
          <el-form-item label="Priority" prop="priority">
            <el-radio-group v-model="account.priority">
              <el-radio label="m">Medium</el-radio>
              <el-radio label="h">High</el-radio>
            </el-radio-group>
          </el-form-item>
        </el-col>
      </el-row>
      <el-row type="flex" justify="center">
        <el-button type="primary" @click="submit('elm-demo')">Create</el-button>
        <el-button @click="reset('elm-demo')">Reset</el-button>
      </el-row>
    </el-form>
  </div>
</template>

<script>
export default {
  data() {
    return {
      account: {
        name: '',
        date: '',
        subscribe: false,
        priority: 'm',
        rate: 5
      },
      formRules: {
        name: [
          { required: true, message: 'Account is required', trigger: 'blur' },
          { min: 6, message: 'Account\'s length is at least 6', trigger: 'blur' }
        ]
      }
    }
  },
  methods: {
    submit(formName) {
      this.$refs[formName].validate((valid) => {
        if (valid) {
          this.$message.success('Create successfully !')
          if (formName === 'popForm') {
            this.popVisible = false
          }
          return false
        } else {
          this.$message.warning('Create failed')
          return false
        }
      })
    },
    reset(formName) {
      this.$refs[formName].resetFields()
    }
  }
}
</script>

<style lang="scss" scoped>
.el-select {
  display: block
}
@media (max-width: 768px) {
  .el-row {
    flex-direction:column;
    .el-button+.el-button {
      margin-left: 0px;
      margin-top: 15px;
    }
  }
}
</style>
